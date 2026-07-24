import { act, render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneTimeRange, SceneVariableSet, useSceneObjectState } from '@grafana/scenes';

import { DashboardMutationClient } from '../mutation-api/DashboardMutationClient';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { type DashboardEditPaneLike } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (_uid: string | null) => ({ uid: 'ds1' }),
  }),
}));

// Header is sidebar chrome (needs Sidebar context); irrelevant to the stale-element question
jest.mock('./EditPaneHeader', () => ({
  EditPaneHeader: () => null,
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

// Mirrors DashboardEditPaneRenderer: renders the current openPane keyed by its scene key
function PaneHost({ editPane }: { editPane: DashboardEditPaneLike }) {
  const { openPane } = useSceneObjectState(editPane, { shouldActivateOrKeepAlive: true });
  return openPane ? <openPane.Component key={openPane.state.key} model={openPane} /> : null;
}

describe('ElementEditPane after UPDATE_VARIABLE mutation', () => {
  it('rebinds the open pane to the replacement variable', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const variable = new CustomVariable({ name: 'region', query: 'a,b,c', label: 'OLD-LABEL' });
    const variableSet = new SceneVariableSet({ variables: [variable] });
    const dashboard = new DashboardScene({
      uid: 'test-dash',
      meta: { canEdit: true, canSave: true },
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      $variables: variableSet,
      isEditing: true,
      body: AutoGridLayoutManager.createEmpty(),
    });

    activateFullSceneTree(dashboard);

    const editPane = dashboard.state.editPane;
    editPane.selectObject(variable, { force: true });

    render(<PaneHost editPane={editPane} />);

    // Sanity: pane shows the original definition
    expect(await screen.findByDisplayValue('OLD-LABEL')).toBeInTheDocument();

    const client = new DashboardMutationClient(dashboard);
    let success = false;
    await act(async () => {
      const result = await client.execute({
        type: 'UPDATE_VARIABLE',
        payload: {
          name: 'region',
          variable: { kind: 'CustomVariable', spec: { name: 'region', query: 'x,y,z', label: 'NEW-LABEL' } },
        },
      });
      success = result.success;
    });
    expect(success).toBe(true);

    // The live scene must hold a NEW object with the PRESERVED key
    const live = dashboard.state.$variables!.getByName('region')!;
    expect(live).not.toBe(variable);
    expect(live.state.key).toBe(variable.state.key);

    // The pane must show the replacement, not the detached original
    expect(await screen.findByDisplayValue('NEW-LABEL')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('OLD-LABEL')).not.toBeInTheDocument();
  });
});
