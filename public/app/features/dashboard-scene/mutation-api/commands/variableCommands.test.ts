import { CustomVariable, type QueryVariable, SceneVariableSet } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../edit-pane/events';
import type { DashboardScene } from '../../scene/DashboardScene';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { DashboardMutationClient } from '../DashboardMutationClient';
import { cmd } from '../cmd';
import type { MutationResult } from '../types';

import { createVariableKindFromSceneVariable } from './variableUtils';

function buildMockScene(
  options: { editable?: boolean; isEditing?: boolean; withEventBus?: boolean } = {}
): DashboardScene {
  const { editable = true, isEditing = false, withEventBus = false } = options;
  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing,
    $variables: new SceneVariableSet({ variables: [] }),
  };
  const scene = {
    state,
    canEditDashboard: jest.fn(() => editable),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    publishEvent: withEventBus ? jest.fn() : undefined,
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
      // Activate new variable set if provided
      const vars = partial.$variables;
      if (vars && typeof (vars as SceneVariableSet).activate === 'function') {
        (vars as SceneVariableSet).activate();
      }
    }),
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene satisfies DashboardScene at runtime
  return scene as unknown as DashboardScene;
}

describe('Variable mutation commands', () => {
  let client: DashboardMutationClient;
  let scene: ReturnType<typeof buildMockScene>;

  beforeEach(() => {
    // Scenes library warns when re-parenting variables via replaceVariableSet
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    scene = buildMockScene({ editable: true });
    client = new DashboardMutationClient(scene);
  });

  it('ADD_VARIABLE adds a variable to the dashboard', async () => {
    const result: MutationResult = await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: {
          kind: 'CustomVariable',
          spec: {
            name: 'env',
            query: 'dev,staging,prod',
          },
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0].path).toBe('/variables/env');
  });

  it('LIST_VARIABLES returns dashboard variables', async () => {
    // First add a variable
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: {
          kind: 'CustomVariable',
          spec: {
            name: 'env',
            query: 'dev,staging,prod',
          },
        },
      },
    });

    const result = await client.execute({
      type: 'LIST_VARIABLES',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('REMOVE_VARIABLE removes a variable by name', async () => {
    // First add a variable
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: {
          kind: 'CustomVariable',
          spec: { name: 'env', query: 'dev,staging,prod' },
        },
      },
    });

    const result = await client.execute({
      type: 'REMOVE_VARIABLE',
      payload: { name: 'env' },
    });

    expect(result.success).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('ADD_VARIABLE with position inserts at the specified index', async () => {
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'first', query: 'a,b' } },
      },
    });
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'third', query: 'x,y' } },
      },
    });

    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'second', query: 'c,d' } },
        position: 1,
      },
    });

    expect(result.success).toBe(true);

    const listResult = await client.execute({ type: 'LIST_VARIABLES', payload: {} });
    expect(listResult.success).toBe(true);
    const variables = (listResult.data as { variables: Array<{ spec: { name: string } }> }).variables;
    expect(variables.map((v) => v.spec.name)).toEqual(['first', 'second', 'third']);
  });

  it('ADD_VARIABLE rejects duplicate variable name', async () => {
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } },
      },
    });

    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'a,b,c' } },
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Variable 'env' already exists");
  });

  it('UPDATE_VARIABLE updates an existing variable', async () => {
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } },
      },
    });

    const result = await client.execute({
      type: 'UPDATE_VARIABLE',
      payload: {
        name: 'env',
        variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod,canary' } },
      },
    });

    expect(result.success).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0].path).toBe('/variables/env');
  });

  it('UPDATE_VARIABLE returns error when variable not found', async () => {
    const result = await client.execute({
      type: 'UPDATE_VARIABLE',
      payload: {
        name: 'nonexistent',
        variable: { kind: 'CustomVariable', spec: { name: 'nonexistent', query: 'a,b' } },
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Variable 'nonexistent' not found");
  });

  it('REMOVE_VARIABLE returns error for non-existent variable', async () => {
    const result = await client.execute({
      type: 'REMOVE_VARIABLE',
      payload: { name: 'nonexistent' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Variable 'nonexistent' not found");
  });

  it('ENTER_EDIT_MODE enters edit mode when not editing', async () => {
    const result = await client.execute({
      type: 'ENTER_EDIT_MODE',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.changes).toEqual([{ path: '/isEditing', previousValue: false, newValue: true }]);
    expect(scene.onEnterEditMode).toHaveBeenCalled();
  });

  it('ENTER_EDIT_MODE is a no-op when already editing', async () => {
    scene = buildMockScene({ editable: true, isEditing: true });
    client = new DashboardMutationClient(scene);

    const result = await client.execute({
      type: 'ENTER_EDIT_MODE',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect((result.data as { wasAlreadyEditing: boolean }).wasAlreadyEditing).toBe(true);
    expect(scene.onEnterEditMode).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads with a validation error', async () => {
    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { invalid: true } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('ADD_VARIABLE Zod rejects unknown variable kind', async () => {
    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'WeirdVariable', spec: { name: 'x' } } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('ADD_VARIABLE Zod rejects CustomVariable with missing query field', async () => {
    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: {} } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('UPDATE_VARIABLE Zod rejects missing name field', async () => {
    const result = await client.execute({
      type: 'UPDATE_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: { name: 'x', query: 'a' } } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('rejects unknown command types', async () => {
    const result = await client.execute({
      type: 'NONEXISTENT_COMMAND',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type');
  });

  it('rejects commands when dashboard is not editable', async () => {
    scene = buildMockScene({ editable: false });
    client = new DashboardMutationClient(scene);

    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: {
          kind: 'CustomVariable',
          spec: { name: 'env', query: 'dev,staging,prod' },
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot edit dashboard');
  });

  // --- cmd builder ---

  it('cmd builder produces correct MutationRequest type strings', () => {
    expect(cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'x', query: 'a' } } }).type).toBe(
      'ADD_VARIABLE'
    );
    expect(
      cmd.updateVariable({ name: 'x', variable: { kind: 'CustomVariable', spec: { name: 'x', query: 'a' } } }).type
    ).toBe('UPDATE_VARIABLE');
    expect(cmd.removeVariable({ name: 'x' }).type).toBe('REMOVE_VARIABLE');
    expect(cmd.listVariables({}).type).toBe('LIST_VARIABLES');
    expect(
      cmd.addPanel({
        panel: {
          kind: 'Panel',
          spec: {
            title: 'T',
            data: { kind: 'QueryGroup', spec: { queries: [] } },
            vizConfig: { kind: 'VizConfig', group: 'timeseries', spec: {} },
          },
        },
        parentPath: '/',
      }).type
    ).toBe('ADD_PANEL');
    expect(cmd.updateDashboardSettings({}).type).toBe('UPDATE_DASHBOARD_SETTINGS');
  });

  it('cmd builder payloads round-trip through execute', async () => {
    const result = await client.execute(
      cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'built', query: 'x,y' } } })
    );
    expect(result.success).toBe(true);
    expect(result.changes[0].path).toBe('/variables/built');
  });

  // --- Undo/redo integration ---

  describe('undo/redo wiring', () => {
    let sceneWithEvents: DashboardScene;
    let clientWithEvents: DashboardMutationClient;

    beforeEach(() => {
      sceneWithEvents = buildMockScene({ editable: true, withEventBus: true });
      clientWithEvents = new DashboardMutationClient(sceneWithEvents);
    });

    it('ADD_VARIABLE publishes DashboardEditActionEvent', async () => {
      await clientWithEvents.execute(
        cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'toAdd', query: 'a,b' } } })
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene has publishEvent as jest.Mock
      expect((sceneWithEvents as unknown as { publishEvent: jest.Mock }).publishEvent).toHaveBeenCalledWith(
        expect.any(DashboardEditActionEvent),
        true
      );
    });

    it('ADD_VARIABLE undo removes the variable', async () => {
      await clientWithEvents.execute(
        cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'willUndo', query: 'a,b' } } })
      );

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene has publishEvent as jest.Mock
      const publishMock = (sceneWithEvents as unknown as { publishEvent: jest.Mock }).publishEvent;
      const event: DashboardEditActionEvent = publishMock.mock.calls[0][0];
      const { undo } = event.payload;

      // Variable should be present before undo
      expect(sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'willUndo')).toBeDefined();

      undo();

      // Variable should be gone after undo
      expect(
        sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'willUndo')
      ).toBeUndefined();
    });

    it('REMOVE_VARIABLE undo restores the variable', async () => {
      await clientWithEvents.execute(
        cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'willRestore', query: 'a,b' } } })
      );

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene has publishEvent as jest.Mock
      const publishMock = (sceneWithEvents as unknown as { publishEvent: jest.Mock }).publishEvent;
      publishMock.mockClear();

      await clientWithEvents.execute(cmd.removeVariable({ name: 'willRestore' }));

      expect(
        sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'willRestore')
      ).toBeUndefined();

      const removeEvent: DashboardEditActionEvent = publishMock.mock.calls[0][0];
      removeEvent.payload.undo();

      expect(
        sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'willRestore')
      ).toBeDefined();
    });

    it('UPDATE_VARIABLE undo restores the previous variable state', async () => {
      await clientWithEvents.execute(
        cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'mutable', query: 'before' } } })
      );

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene has publishEvent as jest.Mock
      const publishMock = (sceneWithEvents as unknown as { publishEvent: jest.Mock }).publishEvent;
      publishMock.mockClear();

      await clientWithEvents.execute(
        cmd.updateVariable({
          name: 'mutable',
          variable: { kind: 'CustomVariable', spec: { name: 'mutable', query: 'after' } },
        })
      );

      // After update the variable should reflect the new query
      const updatedVar = sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'mutable');
      expect((updatedVar as CustomVariable | undefined)?.state.query).toBe('after');

      const updateEvent: DashboardEditActionEvent = publishMock.mock.calls[0][0];
      updateEvent.payload.undo();

      const restoredVar = sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'mutable');
      expect((restoredVar as CustomVariable | undefined)?.state.query).toBe('before');
    });

    it('ADD_VARIABLE redo re-applies the mutation after undo', async () => {
      await clientWithEvents.execute(
        cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'redoable', query: 'a,b' } } })
      );

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene has publishEvent as jest.Mock
      const publishMock = (sceneWithEvents as unknown as { publishEvent: jest.Mock }).publishEvent;
      const event: DashboardEditActionEvent = publishMock.mock.calls[0][0];
      const { perform, undo } = event.payload;

      // Trigger the initial no-op (simulates DashboardEditPane.handleEditAction)
      perform();

      undo();
      expect(
        sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'redoable')
      ).toBeUndefined();

      perform();
      expect(sceneWithEvents.state.$variables?.state.variables.find((v) => v.state.name === 'redoable')).toBeDefined();
    });
  });

  // --- Scenes-native path (cmd.addVariable/updateVariable/removeVariable with SceneVariable) ---

  describe('Scenes-native path', () => {
    it('cmd.addVariable with SceneVariable adds it to the dashboard', async () => {
      const sceneVar = new CustomVariable({ name: 'native', query: 'x,y,z' });
      const result = await client.execute(cmd.addVariable(sceneVar));

      expect(result.success).toBe(true);
      expect(result.changes[0].path).toBe('/variables/native');
      expect(scene.state.$variables?.state.variables.find((v) => v.state.name === 'native')).toBeDefined();
    });

    it('cmd.updateVariable with SceneVariable updates the existing variable', async () => {
      await client.execute(
        cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'updateme', query: 'before' } } })
      );

      const updatedVar = new CustomVariable({ name: 'updateme', query: 'after' });
      const result = await client.execute(cmd.updateVariable(updatedVar));

      expect(result.success).toBe(true);
      expect(result.changes[0].path).toBe('/variables/updateme');
      const stored = scene.state.$variables?.state.variables.find((v) => v.state.name === 'updateme');
      expect((stored as CustomVariable | undefined)?.state.query).toBe('after');
    });

    it('cmd.removeVariable with SceneVariable removes it from the dashboard', async () => {
      await client.execute(
        cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'removeme', query: 'a,b' } } })
      );

      const sceneVar = new CustomVariable({ name: 'removeme', query: 'a,b' });
      const result = await client.execute(cmd.removeVariable(sceneVar));

      expect(result.success).toBe(true);
      expect(scene.state.$variables?.state.variables.find((v) => v.state.name === 'removeme')).toBeUndefined();
    });

    it('cmd.addVariable Scenes-native path produces __scenesPayload request', () => {
      const sceneVar = new CustomVariable({ name: 'check', query: 'a' });
      const request = cmd.addVariable(sceneVar);
      expect(request.type).toBe('ADD_VARIABLE');
      expect('__scenesPayload' in request).toBe(true);
    });

    it('cmd.addVariable payload path still produces payload request', () => {
      const request = cmd.addVariable({ variable: { kind: 'CustomVariable', spec: { name: 'x', query: 'a' } } });
      expect(request.type).toBe('ADD_VARIABLE');
      expect('payload' in request).toBe(true);
    });
  });

  // --- Reverse transformer (createVariableKindFromSceneVariable) ---

  describe('createVariableKindFromSceneVariable round-trip', () => {
    it('CustomVariable survives SceneVariable -> VariableKind -> SceneVariable round-trip', () => {
      const original: Parameters<typeof createSceneVariableFromVariableModel>[0] = {
        kind: 'CustomVariable',
        spec: {
          name: 'env',
          query: 'dev,staging,prod',
          multi: true,
          includeAll: false,
          skipUrlSync: false,
          hide: 'dontHide',
          current: { text: '', value: '' },
          options: [],
          allowCustomValue: true,
        },
      };
      const sceneVar = createSceneVariableFromVariableModel(original);
      const variableKind = createVariableKindFromSceneVariable(sceneVar);
      const roundTripped = createSceneVariableFromVariableModel(variableKind as typeof original);

      expect(roundTripped.state.name).toBe('env');
      expect((roundTripped as CustomVariable).state.query).toBe('dev,staging,prod');
      expect((roundTripped as CustomVariable).state.isMulti).toBe(true);
    });

    it('QueryVariable preserves core fields through round-trip', () => {
      const original: Parameters<typeof createSceneVariableFromVariableModel>[0] = {
        kind: 'QueryVariable',
        spec: {
          name: 'qvar',
          query: { kind: 'DataQuery', group: 'prometheus', version: 'v0', spec: { expr: 'up' } },
          refresh: 'onDashboardLoad',
          regex: '.*',
          sort: 'alphabeticalAsc',
          multi: false,
          includeAll: false,
          skipUrlSync: false,
          hide: 'dontHide',
          current: { text: '', value: '' },
          options: [],
          allowCustomValue: true,
        },
      };
      const sceneVar = createSceneVariableFromVariableModel(original);
      const variableKind = createVariableKindFromSceneVariable(sceneVar);
      const roundTripped = createSceneVariableFromVariableModel(variableKind as typeof original);

      expect(roundTripped.state.name).toBe('qvar');
      expect((roundTripped as QueryVariable).state.regex).toBe('.*');
    });
  });
});
