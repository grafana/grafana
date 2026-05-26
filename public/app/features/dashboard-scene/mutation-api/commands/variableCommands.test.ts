import { SceneVariableSet } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { MutationApiClient } from '../Client';
import { DashboardMutationClient } from '../DashboardMutationClient';

function buildMockScene(options: { editable?: boolean; isEditing?: boolean } = {}): DashboardScene {
  const { editable = true, isEditing = true } = options;
  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing,
    $variables: new SceneVariableSet({ variables: [] }),
  };
  const writeLocks = new Set<string>();
  const scene: Record<string, unknown> = {
    state,
    canEditDashboard: jest.fn(() => editable),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
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
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene satisfies DashboardScene at runtime
  return scene as unknown as DashboardScene;
}

describe('Variable mutation commands', () => {
  let client: MutationApiClient;
  let scene: DashboardScene;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    scene = buildMockScene({ editable: true });
    client = new MutationApiClient(scene);
  });

  it('ADD_VARIABLE adds a variable to the dashboard', async () => {
    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } },
      },
    });

    expect(result.success).toBe(true);
  });

  it('LIST_VARIABLES returns dashboard variables', async () => {
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } },
      },
    });

    const result = await client.execute({ type: 'LIST_VARIABLES', payload: {} });

    expect(result.success).toBe(true);
    const data = result.data as { variables: Array<{ spec: { name: string } }> };
    expect(data.variables.map((v) => v.spec.name)).toEqual(['env']);
  });

  it('REMOVE_VARIABLE removes a variable by name', async () => {
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } },
      },
    });

    const result = await client.execute({ type: 'REMOVE_VARIABLE', payload: { name: 'env' } });

    expect(result.success).toBe(true);
  });

  it('ADD_VARIABLE with position inserts at the specified index', async () => {
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: { name: 'first', query: 'a,b' } } },
    });
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: { name: 'third', query: 'x,y' } } },
    });
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: {
        variable: { kind: 'CustomVariable', spec: { name: 'second', query: 'c,d' } },
        position: 1,
      },
    });

    const list = await client.execute({ type: 'LIST_VARIABLES', payload: {} });
    const variables = (list.data as { variables: Array<{ spec: { name: string } }> }).variables;
    expect(variables.map((v) => v.spec.name)).toEqual(['first', 'second', 'third']);
  });

  it('ADD_VARIABLE rejects duplicate variable name', async () => {
    await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } } },
    });

    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'a,b,c' } } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Variable 'env' already exists");
  });

  it('REMOVE_VARIABLE returns error for non-existent variable', async () => {
    const result = await client.execute({ type: 'REMOVE_VARIABLE', payload: { name: 'nonexistent' } });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Variable 'nonexistent' not found");
  });

  it('rejects invalid payloads with a validation error', async () => {
    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { invalid: true } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('rejects unknown command types', async () => {
    const result = await client.execute({ type: 'NONEXISTENT_COMMAND', payload: {} });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type');
  });

  it('returns an error when dashboard is not editable', async () => {
    scene = buildMockScene({ editable: false });
    client = new MutationApiClient(scene);

    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot edit dashboard');
  });

  it('returns locked:true when the target write-lock is held', async () => {
    scene.acquireWriteLock('variables');

    const result = await client.execute({
      type: 'ADD_VARIABLE',
      payload: { variable: { kind: 'CustomVariable', spec: { name: 'env', query: 'dev,staging,prod' } } },
    });

    expect(result.success).toBe(false);
    expect(result.locked).toBe(true);
  });

  it('list() exposes the registered commands for Assistant discovery', () => {
    const summary = client.list();
    const byType = new Map(summary.map((s) => [s.type, s]));
    expect(byType.get('ADD_VARIABLE')?.kind).toBe('write');
    expect(byType.get('REMOVE_VARIABLE')?.kind).toBe('write');
    expect(byType.get('LIST_VARIABLES')?.kind).toBe('read');
  });
});

describe('Legacy DashboardMutationClient (unmigrated commands)', () => {
  let client: DashboardMutationClient;
  let scene: ReturnType<typeof buildMockScene>;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    scene = buildMockScene({ editable: true });
    client = new DashboardMutationClient(scene);
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

  it('ENTER_EDIT_MODE enters edit mode when not editing', async () => {
    scene = buildMockScene({ editable: true, isEditing: false });
    client = new DashboardMutationClient(scene);

    const result = await client.execute({ type: 'ENTER_EDIT_MODE', payload: {} });

    expect(result.success).toBe(true);
    expect(scene.onEnterEditMode).toHaveBeenCalled();
  });
});
