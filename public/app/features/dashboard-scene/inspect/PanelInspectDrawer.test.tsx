import { waitFor } from '@testing-library/react';

import { getDefaultTimeRange, LoadingState, PanelPlugin } from '@grafana/data';
import { PanelStatusStore } from '@grafana/data/internal';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, VizPanel } from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { InspectErrorsAndNoticesTab } from './InspectErrorsAndNoticesTab';
import { PanelInspectDrawer } from './PanelInspectDrawer';

const plugin = new PanelPlugin(() => null);
setPluginImportUtils({ getPanelPluginFromCache: () => plugin, importPanelPlugin: async () => plugin });

beforeEach(() => {
  plugin.meta.skipDataQuery = true;
});

function setup() {
  const store = new PanelStatusStore();
  const data = new SceneDataNode({ data: { series: [], state: LoadingState.Done, timeRange: getDefaultTimeRange() } });
  const panel = new VizPanel({
    $data: data,
    extendPanelContext: (_, context) => {
      context.notices = store;
    },
  });
  jest.spyOn(panel, 'getPlugin').mockReturnValue(plugin);
  const drawer = new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.ErrorsAndNotices });
  new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]), overlay: drawer });
  return { store, data, panel, drawer, tabs: () => drawer.state.tabs?.map((tab) => tab.getTabValue()) };
}

it('shows an existing panel notice on a non-query panel', async () => {
  const { store, drawer, tabs } = setup();
  const source = store.createSource();
  source.set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);

  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
  expect(drawer.state.tabs?.[0]).toBeInstanceOf(InspectErrorsAndNoticesTab);
  deactivate();
});

it('keeps the original one-shot tab behavior until the reactivity change lands', async () => {
  const { store, drawer, tabs } = setup();
  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.JSON]));

  store.createSource().set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);
  expect(tabs()).toEqual([InspectTab.JSON]);
  deactivate();
});

it('retains the initial query-error tab', async () => {
  plugin.meta.skipDataQuery = false;
  const { data, drawer, tabs } = setup();
  data.setState({ data: { ...data.state.data!, errors: [{ message: 'Query failed' }] } });

  const deactivate = drawer.activate();
  await waitFor(() =>
    expect(tabs()).toEqual([
      InspectTab.Data,
      InspectTab.Stats,
      InspectTab.Query,
      InspectTab.ErrorsAndNotices,
      InspectTab.JSON,
    ])
  );
  deactivate();
});

it('shows an initial plugin-load error on a non-query panel', async () => {
  const { panel, drawer, tabs } = setup();
  panel.setState({ _pluginLoadError: 'Plugin failed' });

  const deactivate = drawer.activate();
  await waitFor(() => expect(tabs()).toEqual([InspectTab.ErrorsAndNotices, InspectTab.JSON]));
  deactivate();
});
