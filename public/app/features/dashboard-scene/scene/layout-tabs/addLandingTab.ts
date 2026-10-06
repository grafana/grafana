import { t } from '@grafana/i18n';
import { SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { type DashboardQuery } from 'app/plugins/datasource/dashboard/types';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/constants';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { getDashboardSceneFor, getDefaultVizPanel } from '../../utils/utils';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { DashboardDatasourceBehaviour } from '../DashboardDatasourceBehaviour';
import { type DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { type TabsLayoutManager } from './TabsLayoutManager';

const CUSTOM_PANEL_PLUGIN_ID = 'custom-panel';
const DEFAULT_MAX_LANDING_SOURCES = 8;

function usesDashboardDatasource(panel: VizPanel): boolean {
  const queryRunner = getQueryRunnerFor(panel);
  if (!queryRunner) {
    return false;
  }

  if (queryRunner.state.datasource?.uid === SHARED_DASHBOARD_QUERY) {
    return true;
  }

  return queryRunner.state.queries.some((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY);
}

/**
 * Panels the landing custom panel can reuse through '-- Dashboard --' queries, in layout order.
 * Custom panels, chained '-- Dashboard --' panels and repeat clones are left out.
 */
export function collectLandingSources(dashboard: DashboardScene, maxSources = DEFAULT_MAX_LANDING_SOURCES): VizPanel[] {
  return dashboardSceneGraph
    .getVizPanels(dashboard)
    .filter(
      (panel) =>
        panel.state.pluginId !== CUSTOM_PANEL_PLUGIN_ID &&
        panel.state.$data !== undefined &&
        !panel.state.repeatSourceKey &&
        !usesDashboardDatasource(panel)
    )
    .slice(0, maxSources);
}

export function buildLandingQueries(sources: VizPanel[]): DashboardQuery[] {
  return sources.map((panel, index) => ({
    refId: String.fromCharCode(65 + index),
    datasource: { type: 'datasource', uid: SHARED_DASHBOARD_QUERY },
    panelId: getPanelIdForVizPanel(panel),
    withTransforms: true,
  }));
}

export async function buildLandingCustomPanel(dashboard: DashboardScene): Promise<VizPanel> {
  const sources = collectLandingSources(dashboard);
  const [panel, { getDefaultDrawingCode }] = await Promise.all([
    getDefaultVizPanel(),
    // Loaded lazily so the dashboard bundle does not pull in the custom panel.
    import(/* webpackChunkName: "customPanel" */ 'app/plugins/panel/custom-panel/templates'),
  ]);

  panel.setState({
    pluginId: CUSTOM_PANEL_PLUGIN_ID,
    title: t('dashboard.tabs-layout.landing.panel-title', 'Overview'),
    options: { code: getDefaultDrawingCode() },
    // Mixed splits '-- Dashboard --' queries into one request per query, since that datasource only reads targets[0].
    $data: new SceneDataTransformer({
      $data: new SceneQueryRunner({
        datasource: { type: 'mixed', uid: MIXED_DATASOURCE_NAME },
        queries: buildLandingQueries(sources),
        $behaviors: [new DashboardDatasourceBehaviour({})],
      }),
      transformations: [],
    }),
  });

  return panel;
}

/**
 * Adds an 'Overview' tab in the first position holding one custom panel that reuses the results
 * of the dashboard's other panels, and switches to it.
 */
export async function addLandingTab(manager: TabsLayoutManager): Promise<TabItem> {
  // Build the panel before inserting anything so the sources do not include the new tab.
  const panel = await buildLandingCustomPanel(getDashboardSceneFor(manager));

  const tab = new TabItem({
    title: t('dashboard.tabs-layout.landing.title', 'Overview'),
    layout: new AutoGridLayoutManager({ fillScreen: true, maxColumnCount: 1 }),
  });

  manager.addNewTab(tab);
  // addPanel assigns the panel id, which needs the tab to be attached to the dashboard.
  tab.getLayout().addPanel(panel);

  const index = manager.getTabsIncludingRepeats().indexOf(tab);
  if (index > 0) {
    manager.moveTab(index, 0);
  }

  manager.switchToTab(tab);

  return tab;
}
