import { store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { LS_STYLES_COPY_KEY } from 'app/core/constants';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
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
  let deactivate: (() => void) | undefined;

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
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

  it.each([undefined, null])('does not record failed pastes with styles=%s', async (styles) => {
    const { dashboard, panel, sidebar } = await setup();
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const alert = jest.spyOn(appEvents, 'emit');
    store.set(LS_STYLES_COPY_KEY, JSON.stringify({ panelType: 'timeseries', styles }));
    try {
      pastePanelStyles(dashboard, panel);
      expect(panel.state.options).toEqual({ legend: { showLegend: true } });
      expect(alert).toHaveBeenCalledWith('alert-error', ['Error pasting panel styles.']);
      expect(sidebar.state.undoStack).toHaveLength(0);
    } finally {
      error.mockRestore();
      alert.mockRestore();
    }
  });

  it.each(['invalid', [], { options: [] }, { fieldConfig: null }])('rejects malformed styles %j', (styles) => {
    store.set(LS_STYLES_COPY_KEY, JSON.stringify({ panelType: 'timeseries', styles }));
    expect(DashboardScene.hasPanelStylesToPaste('timeseries')).toBe(false);
  });

  it('keeps styles pasted onto a repeat clone, which edit actions would rebuild from its source', async () => {
    const gridItem = new DashboardGridItem({
      variableName: 'server',
      body: new VizPanel({ key: 'panel-1', pluginId: 'timeseries', options: { legend: { showLegend: true } } }),
    });
    const dashboard = new DashboardScene({
      isEditing: true,
      $variables: new SceneVariableSet({
        variables: [
          new TestVariable({
            name: 'server',
            query: 'A.*',
            value: ['1', '2'],
            text: ['A', 'B'],
            isMulti: true,
            delayMs: 0,
            optionsToReturn: [
              { label: 'A', value: '1' },
              { label: 'B', value: '2' },
            ],
          }),
        ],
      }),
      body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [gridItem] }) }),
    });
    const deactivateDashboard = activateFullSceneTree(dashboard);
    // wait for the variable to load and create the clones
    await new Promise((r) => setTimeout(r, 1));
    const clone = gridItem.state.repeatedPanels![0];
    const deactivateClone = clone.activate();
    deactivate = () => {
      deactivateClone();
      deactivateDashboard();
    };
    // wait for the clone's panel plugin to load
    await new Promise((r) => setTimeout(r, 1));
    copyStyles(false);

    pastePanelStyles(dashboard, clone);

    expect(gridItem.state.repeatedPanels![0].state.options).toEqual({ legend: { showLegend: false } });
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
  });

  it('does not record pasting when there are no styles to paste', async () => {
    const { dashboard, panel, sidebar } = await setup();

    pastePanelStyles(dashboard, panel);

    expect(sidebar.state.undoStack).toHaveLength(0);
  });
});

describe('pastePanelStyles (legacy layouts)', () => {
  beforeEach(() => setTestFlags({ dashboardNewLayouts: false }));

  let deactivate: (() => void) | undefined;

  afterEach(() => {
    setTestFlags({});
    deactivate?.();
    deactivate = undefined;
    store.delete(LS_STYLES_COPY_KEY);
  });

  it('pastes styles without undo history, since the sidebar is not active in legacy layouts', async () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
      options: { legend: { showLegend: true } },
    });
    const dashboard = new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    deactivate = activateFullSceneTree(dashboard.state.body);
    await new Promise((r) => setTimeout(r, 1));
    copyStyles(false);

    pastePanelStyles(dashboard, panel);

    expect(panel.state.options).toEqual({ legend: { showLegend: false } });
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
  });
});
