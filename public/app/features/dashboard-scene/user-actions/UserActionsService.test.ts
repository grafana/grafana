import { sceneGraph, SceneVariableSet, TestVariable } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import type { DashboardScene } from '../scene/DashboardScene';

import { UserActionsService } from './UserActionsService';
import { AddVariableCommand } from './commands/AddVariableCommand';
import { RemoveVariableCommand } from './commands/RemoveVariableCommand';

// Avoid pulling the heavy serialization import chain into the test runtime.
// The commands need a VariableKind -> SceneVariable converter; here a TestVariable
// keyed by name is enough to exercise stack mechanics and index ordering.
jest.mock('../serialization/transformSaveModelSchemaV2ToScene', () => ({
  createSceneVariableFromVariableModel: (variable: { spec: { name: string } }) =>
    new TestVariable({ name: variable.spec.name, query: '', value: '' }),
}));

function buildMockScene(options: { editable?: boolean } = {}): DashboardScene {
  const { editable = true } = options;
  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing: true,
    $variables: new SceneVariableSet({ variables: [] }),
  };
  const writeLocks = new Set<string>();
  const scene: Record<string, unknown> = {
    state,
    canEditDashboard: jest.fn(() => editable),
    forceRender: jest.fn(),
    publishEvent: jest.fn(),
    acquireWriteLock: (t: string) => writeLocks.add(t),
    releaseWriteLock: (t: string) => writeLocks.delete(t),
    isWriteLocked: (t: string) => writeLocks.has(t),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
      const vars = partial.$variables;
      if (vars && typeof (vars as SceneVariableSet).activate === 'function') {
        (vars as SceneVariableSet).activate();
      }
    }),
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return scene as unknown as DashboardScene;
}

function makeVar(name: string): VariableKind {
  return {
    kind: 'QueryVariable',
    spec: {
      name,
      label: name,
      hide: 'dontHide',
      skipUrlSync: false,
      current: { value: '', text: '' },
      options: [],
      query: { kind: 'DataQuery', spec: {}, group: 'prometheus', version: 'v0' },
      definition: '',
      sort: 'disabled',
      refresh: 'never',
      regex: '',
      includeAll: false,
      multi: false,
      allowCustomValue: true,
    },
  };
}

function getVariableNames(scene: DashboardScene): string[] {
  return sceneGraph.getVariables(scene).state.variables.map((v) => v.state.name);
}

describe('UserActionsService', () => {
  // TestVariable instances trigger a Scenes lifecycle warning when moved between
  // SceneVariableSets in the mock. Suppress it here -- the real DashboardScene
  // and replaceVariableSet handle activation correctly.
  let consoleWarnSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('execute', () => {
    it('rejects when dashboard is not editable', () => {
      const scene = buildMockScene({ editable: false });
      const service = new UserActionsService(scene);
      const result = service.execute(new AddVariableCommand(scene, makeVar('x')));
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission/);
    });

    it('adds a variable and calls forceRender', () => {
      const scene = buildMockScene();
      const service = new UserActionsService(scene);
      service.execute(new AddVariableCommand(scene, makeVar('env')));
      expect(getVariableNames(scene)).toEqual(['env']);
      expect(scene.forceRender).toHaveBeenCalledTimes(1);
    });

    it('returns success: false when perform() throws (duplicate name)', () => {
      const scene = buildMockScene();
      const service = new UserActionsService(scene);
      service.execute(new AddVariableCommand(scene, makeVar('env')));
      const result = service.execute(new AddVariableCommand(scene, makeVar('env')));
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already exists/);
    });

    it('returns locked:true when the target is write-locked, without mutating state', () => {
      const scene = buildMockScene();
      const service = new UserActionsService(scene);

      scene.acquireWriteLock('variables');
      const result = service.execute(new AddVariableCommand(scene, makeVar('env')));
      expect(result.success).toBe(false);
      expect(result.locked).toBe(true);
      expect(result.error).toMatch(/locked/);
      expect(getVariableNames(scene)).toEqual([]);

      scene.releaseWriteLock('variables');
      const result2 = service.execute(new AddVariableCommand(scene, makeVar('env')));
      expect(result2.success).toBe(true);
      expect(result2.locked).toBe(false);
      expect(getVariableNames(scene)).toEqual(['env']);
    });

    it('clears the redo stack on a new action', () => {
      const scene = buildMockScene();
      const service = new UserActionsService(scene);
      service.execute(new AddVariableCommand(scene, makeVar('a')));
      service.undo();
      service.execute(new AddVariableCommand(scene, makeVar('b')));
      expect(service.redo()).toBe(false);
    });
  });

  describe('canonical undo test -- remove middle of three, redo restores at the right index', () => {
    it('restores index 1 after undo, re-removes on redo', () => {
      const scene = buildMockScene();
      const service = new UserActionsService(scene);

      const varA = makeVar('a');
      const varB = makeVar('b');
      const varC = makeVar('c');

      service.execute(new AddVariableCommand(scene, varA));
      service.execute(new AddVariableCommand(scene, varB));
      service.execute(new AddVariableCommand(scene, varC));
      expect(getVariableNames(scene)).toEqual(['a', 'b', 'c']);

      // Remove the middle variable (b is at index 1)
      service.execute(new RemoveVariableCommand(scene, 'b', varB));
      expect(getVariableNames(scene)).toEqual(['a', 'c']);

      // Undo: b should be restored at index 1
      service.undo();
      expect(getVariableNames(scene)).toEqual(['a', 'b', 'c']);

      // Redo: b should be removed again
      service.redo();
      expect(getVariableNames(scene)).toEqual(['a', 'c']);
    });
  });

  describe('multiplayer composition -- mutations apply against latest state', () => {
    it('two sequential execute calls each read the latest scene state', () => {
      const scene = buildMockScene();
      const service = new UserActionsService(scene);

      service.execute(new AddVariableCommand(scene, makeVar('first')));
      // second call must see 'first' already present
      service.execute(new AddVariableCommand(scene, makeVar('second')));

      expect(getVariableNames(scene)).toEqual(['first', 'second']);

      // Undo twice in reverse order
      service.undo();
      expect(getVariableNames(scene)).toEqual(['first']);
      service.undo();
      expect(getVariableNames(scene)).toEqual([]);
    });
  });

  describe('peekUndoTitle / peekRedoTitle', () => {
    it('returns the title of the last command on each stack', () => {
      const scene = buildMockScene();
      const service = new UserActionsService(scene);

      expect(service.peekUndoTitle()).toBeUndefined();

      service.execute(new AddVariableCommand(scene, makeVar('env')));
      expect(service.peekUndoTitle()).toBe("Add variable 'env'");
      expect(service.peekRedoTitle()).toBeUndefined();

      service.undo();
      expect(service.peekUndoTitle()).toBeUndefined();
      expect(service.peekRedoTitle()).toBe("Add variable 'env'");
    });
  });
});
