import { createElement } from 'react';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { type PanelPluginMeta } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setDataSourceSrv, setPluginImportUtils, type DataSourceSrv } from '@grafana/runtime';
import { FlagKeys, setPanelPluginMetas } from '@grafana/runtime/internal';
import { SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import {
  type Spec as DashboardV2Spec,
  defaultSpec,
  type PanelKind,
  type PanelQueryKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { getDefaultDrawingCode } from 'app/plugins/panel/custom-panel/templates';

import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModel } from '../../serialization/transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardEditActionEvent } from '../../sidebar/events';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';
import { addLandingTab, buildLandingQueries, collectLandingSources } from './addLandingTab';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const DASHBOARD_DS_QUERIES = [
  {
    refId: 'A',
    datasource: { type: 'datasource', uid: '-- Dashboard --' },
    panelId: 1,
    withTransforms: true,
  },
  {
    refId: 'B',
    datasource: { type: 'datasource', uid: '-- Dashboard --' },
    panelId: 4,
    withTransforms: true,
  },
];

function testDataQuery(refId: string): PanelQueryKind {
  return {
    kind: 'PanelQuery',
    spec: {
      refId,
      hidden: false,
      query: {
        kind: 'DataQuery',
        group: 'grafana-testdata-datasource',
        version: 'v0',
        datasource: { name: 'testdata' },
        spec: { scenarioId: 'random_walk' },
      },
    },
  };
}

function dashboardDataQuery(panelId: number): PanelQueryKind {
  return {
    kind: 'PanelQuery',
    spec: {
      refId: 'A',
      hidden: false,
      query: {
        kind: 'DataQuery',
        group: 'datasource',
        version: 'v0',
        datasource: { name: '-- Dashboard --' },
        spec: { panelId },
      },
    },
  };
}

function panel(
  id: number,
  pluginId: string,
  queries: PanelQueryKind[],
  options: Record<string, unknown> = {}
): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      id,
      title: `Panel ${id}`,
      links: [],
      data: { kind: 'QueryGroup', spec: { queries, transformations: [], queryOptions: {} } },
      vizConfig: {
        kind: 'VizConfig',
        group: pluginId,
        version: '',
        spec: { options, fieldConfig: { defaults: {}, overrides: [] } },
      },
    },
  };
}

function autoGrid(panelIds: number[]) {
  return {
    kind: 'AutoGridLayout' as const,
    spec: {
      maxColumnCount: 3,
      columnWidthMode: 'standard' as const,
      rowHeightMode: 'standard' as const,
      items: panelIds.map((id) => ({
        kind: 'AutoGridLayoutItem' as const,
        spec: { element: { kind: 'ElementReference' as const, name: `panel-${id}` } },
      })),
    },
  };
}

function toDto(spec: DashboardV2Spec): DashboardWithAccessInfo<DashboardV2Spec> {
  return {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'v2',
    metadata: { name: 'landing-test', resourceVersion: '1', creationTimestamp: '', generation: 1, annotations: {} },
    spec,
    access: {},
  };
}

/**
 * Two tabs: 'Metrics' holds a testdata panel (1) and a custom panel (2), 'Details' holds a panel chained
 * through '-- Dashboard --' (3) and a second testdata panel (4). Only panels 1 and 4 are landing sources.
 */
function buildDashboard(): { dashboard: DashboardScene; manager: TabsLayoutManager } {
  const spec: DashboardV2Spec = {
    ...defaultSpec(),
    title: 'Landing test',
    elements: {
      'panel-1': panel(1, 'timeseries', [testDataQuery('A')]),
      'panel-2': panel(2, 'custom-panel', [testDataQuery('A')], { code: 'panel.onRender(() => {});' }),
      'panel-3': panel(3, 'stat', [dashboardDataQuery(1)]),
      'panel-4': panel(4, 'stat', [testDataQuery('A')]),
    },
    layout: {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          { kind: 'TabsLayoutTab', spec: { title: 'Metrics', layout: autoGrid([1, 2]) } },
          { kind: 'TabsLayoutTab', spec: { title: 'Details', layout: autoGrid([3, 4]) } },
        ],
      },
    },
  };

  const dashboard = transformSaveModelSchemaV2ToScene(toDto(spec));
  // Stand in for the edit sidebar, which performs each edit action and records it for undo.
  dashboard.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => payload.perform());
  const manager = dashboard.state.body;
  if (!(manager instanceof TabsLayoutManager)) {
    throw new Error('Expected a tabs layout');
  }

  return { dashboard, manager };
}

function getLandingPanel(manager: TabsLayoutManager): VizPanel {
  const panels = manager.state.tabs[0].getLayout().getVizPanels();
  expect(panels).toHaveLength(1);
  return panels[0];
}

describe('addLandingTab', () => {
  beforeAll(() => {
    setDataSourceSrv({ getInstanceSettings: () => undefined } as unknown as DataSourceSrv);
  });

  describe('collectLandingSources', () => {
    it('returns the queryable panels in layout order, without custom or chained panels', () => {
      const { dashboard } = buildDashboard();

      expect(collectLandingSources(dashboard).map(getPanelIdForVizPanel)).toEqual([1, 4]);
    });

    it('stops at maxSources', () => {
      const { dashboard } = buildDashboard();

      expect(collectLandingSources(dashboard, 1).map(getPanelIdForVizPanel)).toEqual([1]);
    });
  });

  it('builds one dashboard query per source with sequential refIds', () => {
    const { dashboard } = buildDashboard();

    expect(buildLandingQueries(collectLandingSources(dashboard))).toEqual(DASHBOARD_DS_QUERIES);
  });

  it('inserts an Overview tab first, selects it, and fills it with one custom panel', async () => {
    const { manager } = buildDashboard();

    const tab = await addLandingTab(manager);

    expect(manager.state.tabs.map((t) => t.state.title)).toEqual(['Overview', 'Metrics', 'Details']);
    expect(manager.state.tabs[0]).toBe(tab);
    expect(manager.getCurrentTab()).toBe(tab);

    const layout = tab.getLayout();
    expect(layout).toBeInstanceOf(AutoGridLayoutManager);
    expect((layout as AutoGridLayoutManager).state.fillScreen).toBe(true);
    expect((layout as AutoGridLayoutManager).state.maxColumnCount).toBe(1);

    const landing = getLandingPanel(manager);
    expect(landing.state.pluginId).toBe('custom-panel');
    expect(landing.state.title).toBe('Overview');
    expect(landing.state.options).toEqual({ code: getDefaultDrawingCode() });
    expect(getPanelIdForVizPanel(landing)).toBe(5);

    const queryRunner = getQueryRunnerFor(landing);
    expect(queryRunner).toBeInstanceOf(SceneQueryRunner);
    expect(queryRunner?.state.datasource).toEqual({ type: 'mixed', uid: '-- Mixed --' });
    expect(queryRunner?.state.queries).toEqual(DASHBOARD_DS_QUERIES);
  });

  it('keeps the custom panel and its queries through a v2 save and load', async () => {
    const { dashboard, manager } = buildDashboard();
    await addLandingTab(manager);

    const saved = transformSceneToSaveModelSchemaV2(dashboard);
    const element = saved.elements['panel-5'];
    expect(element.kind).toBe('Panel');
    if (element.kind !== 'Panel') {
      return;
    }
    expect(element.spec.vizConfig.group).toBe('custom-panel');
    expect(element.spec.vizConfig.spec.options).toEqual({ code: getDefaultDrawingCode() });

    const reloaded = transformSaveModelSchemaV2ToScene(toDto(saved));
    const reloadedManager = reloaded.state.body as TabsLayoutManager;
    expect(reloadedManager.state.tabs.map((t) => t.state.title)).toEqual(['Overview', 'Metrics', 'Details']);

    const landing = getLandingPanel(reloadedManager);
    expect(landing.state.pluginId).toBe('custom-panel');
    expect(landing.state.options).toEqual({ code: getDefaultDrawingCode() });

    const queryRunner = getQueryRunnerFor(landing);
    expect(queryRunner?.state.datasource).toEqual({ type: 'mixed', uid: '-- Mixed --' });
    expect(
      queryRunner?.state.queries.map(({ refId, datasource, panelId, withTransforms }) => ({
        refId,
        datasource,
        panelId,
        withTransforms,
      }))
    ).toEqual(DASHBOARD_DS_QUERIES);
  });

  it('keeps the custom panel and its queries in the v1 save model', async () => {
    const { dashboard, manager } = buildDashboard();
    await addLandingTab(manager);

    const saved = transformSceneToSaveModel(dashboard);
    const landing = saved.panels?.find((p) => p.id === 5);

    expect(landing?.type).toBe('custom-panel');
    expect(landing && 'options' in landing ? landing.options : undefined).toEqual({ code: getDefaultDrawingCode() });
    expect(landing?.datasource).toEqual({ type: 'mixed', uid: '-- Mixed --' });
    expect(landing && 'targets' in landing ? landing.targets : undefined).toEqual(DASHBOARD_DS_QUERIES);
  });
});

describe('TabsLayoutManagerRenderer add landing tab button', () => {
  const textPanelMeta = { id: 'text', name: 'Text' } as PanelPluginMeta;
  const customPanelMeta = { id: 'custom-panel', name: 'Custom panel' } as PanelPluginMeta;

  beforeAll(() => {
    setTestFlags({ [FlagKeys.GrafanaCustomPanel]: true });
    // The landing panel's query runner resolves its datasource once rendered; keep it pending.
    setDataSourceSrv({
      getInstanceSettings: () => undefined,
      get: () => new Promise(() => {}),
    } as unknown as DataSourceSrv);
  });

  afterAll(() => {
    setTestFlags({});
  });

  it('hides the button while the custom panel flag is off', async () => {
    setTestFlags({ [FlagKeys.GrafanaCustomPanel]: false });
    setPanelPluginMetas({ text: textPanelMeta, 'custom-panel': customPanelMeta });
    renderTabs(true);
    await waitForEditableTabBar();
    setTestFlags({ [FlagKeys.GrafanaCustomPanel]: true });

    expect(screen.getByTestId(selectors.components.CanvasGridAddActions.addTab)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.CanvasGridAddActions.addLandingTab)).not.toBeInTheDocument();
  });

  function renderTabs(isEditing: boolean) {
    const manager = new TabsLayoutManager({
      tabs: [new TabItem({ title: 'Metrics' }), new TabItem({ title: 'Details' })],
    });
    const dashboard = new DashboardScene({ body: manager, isEditing });
    dashboard.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => payload.perform());
    render(createElement(manager.Component, { model: manager }));
    return manager;
  }

  // Drag and drop loads lazily and remounts the tab bar once it arrives, after the plugin meta lookup settles.
  async function waitForEditableTabBar() {
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Metrics' }).closest('[data-rfd-draggable-id]')).not.toBeNull()
    );
  }

  it('adds and selects the landing tab when clicked while editing with the custom panel registered', async () => {
    setPanelPluginMetas({ text: textPanelMeta, 'custom-panel': customPanelMeta });
    const manager = renderTabs(true);
    await waitForEditableTabBar();

    await userEvent.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.addLandingTab));

    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(manager.state.tabs.map((tab) => tab.state.title)).toEqual(['Overview', 'Metrics', 'Details']);
  });

  it('hides the button when the custom panel is not registered', async () => {
    setPanelPluginMetas({ text: textPanelMeta });
    renderTabs(true);
    await waitForEditableTabBar();

    expect(screen.getByTestId(selectors.components.CanvasGridAddActions.addTab)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.CanvasGridAddActions.addLandingTab)).not.toBeInTheDocument();
  });

  it('hides the button outside edit mode', () => {
    setPanelPluginMetas({ text: textPanelMeta, 'custom-panel': customPanelMeta });
    renderTabs(false);

    expect(screen.getByRole('tab', { name: 'Metrics' })).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.CanvasGridAddActions.addLandingTab)).not.toBeInTheDocument();
  });
});
