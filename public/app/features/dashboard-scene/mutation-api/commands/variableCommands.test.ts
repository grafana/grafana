import { CustomVariable, SceneVariableSet } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { getTestDashboardSceneFromSaveModel } from '../../utils/test-utils';
import { DashboardMutationClient } from '../DashboardMutationClient';
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
    activateEditPane: jest.fn(),
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

  describe('parentPath (section variables)', () => {
    function buildSceneWithRow(): DashboardScene {
      const row = new RowItem({ title: 'R', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      const body = new RowsLayoutManager({ rows: [row] });
      const state: Record<string, unknown> = {
        uid: 'test-dash',
        isEditing: true,
        body,
        $variables: new SceneVariableSet({ variables: [] }),
      };
      const scene = {
        state,
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        activateEditPane: jest.fn(),
        forceRender: jest.fn(),
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

    function buildSceneWithNestedRowsInTab(): DashboardScene {
      const nestedRows = new RowsLayoutManager({
        rows: [
          new RowItem({ title: 'R0', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
          new RowItem({ title: 'R1', layout: DefaultGridLayoutManager.fromVizPanels([]) }),
        ],
      });
      const body = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'T0', layout: nestedRows })],
      });
      const state: Record<string, unknown> = {
        uid: 'test-dash',
        isEditing: true,
        body,
        $variables: new SceneVariableSet({ variables: [] }),
      };
      const scene = {
        state,
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        activateEditPane: jest.fn(),
        forceRender: jest.fn(),
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

    function buildSceneWithInactiveTab(): DashboardScene {
      const tab0 = new TabItem({ title: 'T0', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      const tab1 = new TabItem({ title: 'T1', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      const body = new TabsLayoutManager({
        tabs: [tab0, tab1],
        currentTabSlug: tab0.getSlug(),
      });
      const state: Record<string, unknown> = {
        uid: 'test-dash',
        isEditing: true,
        body,
        $variables: new SceneVariableSet({ variables: [] }),
      };
      const scene = {
        state,
        canEditDashboard: jest.fn(() => true),
        onEnterEditMode: jest.fn(() => {
          state.isEditing = true;
        }),
        activateEditPane: jest.fn(),
        forceRender: jest.fn(),
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

    it('ADD_VARIABLE with parentPath adds to row scope and uses scoped change path', async () => {
      scene = buildSceneWithRow();
      client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_VARIABLE',
        payload: {
          parentPath: '/rows/0',
          variable: { kind: 'CustomVariable', spec: { name: 'rowVar', query: '1,2' } },
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes[0].path).toBe('/rows/0/variables/rowVar');
      const body = scene.state.body as RowsLayoutManager;
      expect(body.state.rows[0].state.$variables?.getByName('rowVar')).toBeDefined();
    });

    it('UPDATE_VARIABLE without parentPath errors when variable exists only on a row', async () => {
      scene = buildSceneWithRow();
      const body = scene.state.body as RowsLayoutManager;
      const rowVarSet = new SceneVariableSet({
        variables: [new CustomVariable({ name: 'onlyRow', query: 'a,b' })],
      });
      body.state.rows[0].setState({ $variables: rowVarSet });
      rowVarSet.activate();
      client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'UPDATE_VARIABLE',
        payload: {
          name: 'onlyRow',
          variable: { kind: 'CustomVariable', spec: { name: 'onlyRow', query: 'a,b,c' } },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not on the dashboard');
      expect(result.error).toContain('parentPath');
    });

    it('UPDATE_VARIABLE with parentPath updates row variable', async () => {
      scene = buildSceneWithRow();
      client = new DashboardMutationClient(scene);
      await client.execute({
        type: 'ADD_VARIABLE',
        payload: {
          parentPath: '/rows/0',
          variable: { kind: 'CustomVariable', spec: { name: 'rowVar', query: '1,2' } },
        },
      });

      const result = await client.execute({
        type: 'UPDATE_VARIABLE',
        payload: {
          parentPath: '/rows/0',
          name: 'rowVar',
          variable: { kind: 'CustomVariable', spec: { name: 'rowVar', query: '1,2,3' } },
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes[0].path).toBe('/rows/0/variables/rowVar');
    });

    it('UPDATE_VARIABLE supports nested parentPath like /tabs/0/rows/1', async () => {
      scene = buildSceneWithNestedRowsInTab();
      client = new DashboardMutationClient(scene);

      await client.execute({
        type: 'ADD_VARIABLE',
        payload: {
          parentPath: '/tabs/0/rows/1',
          variable: { kind: 'CustomVariable', spec: { name: 'nestedVar', query: 'a,b' } },
        },
      });

      const result = await client.execute({
        type: 'UPDATE_VARIABLE',
        payload: {
          parentPath: '/tabs/0/rows/1',
          name: 'nestedVar',
          variable: { kind: 'CustomVariable', spec: { name: 'nestedVar', query: 'a,b,c' } },
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes[0].path).toBe('/tabs/0/rows/1/variables/nestedVar');
      const body = scene.state.body as TabsLayoutManager;
      const nestedRow = (body.state.tabs[0].state.layout as RowsLayoutManager).state.rows[1];
      expect(nestedRow.state.$variables?.getByName('nestedVar')).toBeDefined();
    });

    it('LIST_VARIABLES with parentPath returns only that scope', async () => {
      scene = buildSceneWithRow();
      client = new DashboardMutationClient(scene);
      await client.execute({
        type: 'ADD_VARIABLE',
        payload: {
          variable: { kind: 'CustomVariable', spec: { name: 'dashVar', query: 'x,y' } },
        },
      });
      await client.execute({
        type: 'ADD_VARIABLE',
        payload: {
          parentPath: '/rows/0',
          variable: { kind: 'CustomVariable', spec: { name: 'rowVar', query: '1,2' } },
        },
      });

      const dashList = await client.execute({ type: 'LIST_VARIABLES', payload: {} });
      const rowList = await client.execute({ type: 'LIST_VARIABLES', payload: { parentPath: '/rows/0' } });

      expect(dashList.success).toBe(true);
      expect(rowList.success).toBe(true);
      const dashVars = (dashList.data as { variables: Array<{ spec: { name: string } }> }).variables;
      const rowVars = (rowList.data as { variables: Array<{ spec: { name: string } }> }).variables;
      expect((dashList.data as { scopePath: string }).scopePath).toBe('/');
      expect((rowList.data as { scopePath: string }).scopePath).toBe('/rows/0');
      expect(dashVars.map((v) => v.spec.name)).toEqual(['dashVar']);
      expect(rowVars.map((v) => v.spec.name)).toEqual(['rowVar']);
    });

    it('ADD_VARIABLE works for parentPath on an inactive tab', async () => {
      scene = buildSceneWithInactiveTab();
      client = new DashboardMutationClient(scene);

      const result = await client.execute({
        type: 'ADD_VARIABLE',
        payload: {
          parentPath: '/tabs/1',
          variable: { kind: 'CustomVariable', spec: { name: 'inactiveTabVar', query: 'a,b' } },
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes[0].path).toBe('/tabs/1/variables/inactiveTabVar');
      const body = scene.state.body as TabsLayoutManager;
      expect(body.state.tabs[1].state.$variables?.getByName('inactiveTabVar')).toBeDefined();
    });
  });

  describe('real DashboardScene coverage', () => {
    it('runs section variable mutations against a real DashboardScene instance', async () => {
      const scene = getTestDashboardSceneFromSaveModel();
      const row = new RowItem({ title: 'R', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      scene.setState({
        body: new RowsLayoutManager({ rows: [row] }),
        isEditing: true,
      });

      const executor = new DashboardMutationClient(scene);

      const addResult = await executor.execute({
        type: 'ADD_VARIABLE',
        payload: {
          parentPath: '/rows/0',
          variable: { kind: 'CustomVariable', spec: { name: 'realSceneVar', query: 'a,b' } },
        },
      });
      expect(addResult.success).toBe(true);
      expect(addResult.changes[0].path).toBe('/rows/0/variables/realSceneVar');
      expect(row.state.$variables?.getByName('realSceneVar')).toBeDefined();

      const updateResult = await executor.execute({
        type: 'UPDATE_VARIABLE',
        payload: {
          parentPath: '/rows/0',
          name: 'realSceneVar',
          variable: { kind: 'CustomVariable', spec: { name: 'realSceneVar', query: 'a,b,c' } },
        },
      });
      expect(updateResult.success).toBe(true);

      const removeResult = await executor.execute({
        type: 'REMOVE_VARIABLE',
        payload: {
          parentPath: '/rows/0',
          name: 'realSceneVar',
        },
      });
      expect(removeResult.success).toBe(true);
      expect(row.state.$variables).toBeUndefined();
    });
  });
});
