import { SceneVariableSet } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { MutationExecutor } from '../MutationExecutor';
import type { MutationResult } from '../types';

function buildMockScene(options: { editable?: boolean; isEditing?: boolean } = {}): DashboardScene {
  const { editable = true, isEditing = false } = options;
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
  let executor: MutationExecutor;
  let scene: ReturnType<typeof buildMockScene>;

  beforeEach(() => {
    scene = buildMockScene({ editable: true });
    executor = new MutationExecutor(scene);
  });

  it('ADD_VARIABLE adds a variable to the dashboard', async () => {
    const result: MutationResult = await executor.execute({
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
    await executor.execute({
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

    const result = await executor.execute({
      type: 'LIST_VARIABLES',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('REMOVE_VARIABLE removes a variable by name', async () => {
    // First add a variable
    await executor.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: {
          kind: 'CustomVariable',
          spec: { name: 'env', query: 'dev,staging,prod' },
        },
      },
    });

    const result = await executor.execute({
      type: 'REMOVE_VARIABLE',
      payload: { name: 'env' },
    });

    expect(result.success).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('rejects invalid payloads with a validation error', async () => {
    const result = await executor.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { invalid: true } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('rejects unknown command types', async () => {
    const result = await executor.execute({
      type: 'NONEXISTENT_COMMAND',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type');
  });

  it('rejects commands when dashboard is not editable', async () => {
    scene = buildMockScene({ editable: false });
    executor = new MutationExecutor(scene);

    const result = await executor.execute({
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
});
