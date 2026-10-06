import { store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { LS_STYLES_COPY_KEY } from 'app/core/constants';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { pastePanelStyles } from './pastePanelStyles';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'timeseries' })),
  getPanelPluginFromCache: () => undefined,
});

function copyStyles(showLegend: boolean) {
  store.set(
    LS_STYLES_COPY_KEY,
    JSON.stringify({
      panelType: 'timeseries',
      styles: { options: { legend: { showLegend } } },
    })
  );
}

describe('pastePanelStyles', () => {
  let deactivate: () => void;

  afterEach(() => {
    deactivate?.();
    store.delete(LS_STYLES_COPY_KEY);
  });

  async function setup() {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
      options: { legend: { showLegend: true } },
    });
    const dashboard = new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    deactivate = activateFullSceneTree(dashboard);
    // wait for the panel plugin to load
    await new Promise((r) => setTimeout(r, 1));

    return { dashboard, panel, sidebar: dashboard.state.sidebar };
  }

  it('pastes copied styles as one undoable action', async () => {
    const { dashboard, panel, sidebar } = await setup();
    copyStyles(false);

    pastePanelStyles(dashboard, panel);

    expect(panel.state.options).toEqual({ legend: { showLegend: false } });
    expect(sidebar.state.undoStack).toHaveLength(1);
  });

  it('undoes pasted styles', async () => {
    const { dashboard, panel, sidebar } = await setup();
    copyStyles(false);
    pastePanelStyles(dashboard, panel);

    sidebar.undoAction();

    expect(panel.state.options).toEqual({ legend: { showLegend: true } });
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('redoes the originally pasted styles even when other styles were copied since', async () => {
    const { dashboard, panel, sidebar } = await setup();
    copyStyles(false);
    pastePanelStyles(dashboard, panel);
    sidebar.undoAction();
    copyStyles(true);

    sidebar.redoAction();

    expect(panel.state.options).toEqual({ legend: { showLegend: false } });
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });

  it('does not record pasting when there are no styles to paste', async () => {
    const { dashboard, panel, sidebar } = await setup();

    pastePanelStyles(dashboard, panel);

    expect(sidebar.state.undoStack).toHaveLength(0);
  });
});
