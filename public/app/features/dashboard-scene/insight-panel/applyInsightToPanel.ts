import { AppEvents, FieldType, type DataFrameDTO } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type VizPanel } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';

import { type DashboardScene } from '../scene/DashboardScene';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { buildMockInsightMarkdown } from './mockInsightMarkdown';
import { INSIGHT_FIELD_NAME, type InsightDataQuery, type InsightPanelConfig } from './types';

export const TEXT_PANEL_PLUGIN_ID = 'text';

/** Mock datasource, until the insight datasource exists. */
const MOCK_PLUGIN_ID = 'grafana-testdata-datasource';
const MOCK_SCENARIO_ID = 'raw_frame';

/**
 * Renders whatever markdown the insight datasource returned. Triple-stashed so Handlebars
 * hands the markdown through unescaped.
 */
const INSIGHT_CONTENT_TEMPLATE = `{{{data.[0].${INSIGHT_FIELD_NAME}}}}`;

async function getMockDataSourceRef(): Promise<DataSourceRef | undefined> {
  const [instance] = await getDataSourceInstanceList({ pluginId: MOCK_PLUGIN_ID, all: true });

  if (!instance) {
    appEvents.emit(AppEvents.alertWarning, [
      t('dashboard.insight-panel.missing-mock-datasource', 'No TestData DB datasource found'),
      t(
        'dashboard.insight-panel.missing-mock-datasource-detail',
        'The insight panel is mocked with TestData DB. Add a TestData DB datasource to see a response.'
      ),
    ]);
    return undefined;
  }

  return { type: instance.type, uid: instance.uid };
}

function buildInsightQuery(config: InsightPanelConfig): InsightDataQuery {
  const frame: DataFrameDTO = {
    name: INSIGHT_FIELD_NAME,
    fields: [{ name: INSIGHT_FIELD_NAME, type: FieldType.string, values: [buildMockInsightMarkdown(config)] }],
  };

  return {
    refId: 'A',
    prompt: config.prompt,
    insightContext: config.context,
    scenarioId: MOCK_SCENARIO_ID,
    rawFrameContent: JSON.stringify([frame]),
  };
}

/**
 * Turns an unconfigured panel into an insight panel: a Text panel rendering the markdown its
 * query returns. Requires the `grafana.newTextPanel` and `text.newFeatures` flags — without them
 * the Text panel takes no queries and does not template its content.
 */
export async function applyInsightToPanel(
  dashboard: DashboardScene,
  panel: VizPanel,
  config: InsightPanelConfig
): Promise<void> {
  await dashboard.changePanelPlugin(panel, TEXT_PANEL_PLUGIN_ID, {
    mode: 'markdown',
    renderMode: 'once',
    content: INSIGHT_CONTENT_TEMPLATE,
  });

  dashboard.updatePanelTitle(panel, t('dashboard.insight-panel.default-title', 'Insights'));

  const queryRunner = getQueryRunnerFor(panel);
  if (!queryRunner) {
    return;
  }

  queryRunner.setState({
    datasource: await getMockDataSourceRef(),
    queries: [buildInsightQuery(config)],
  });
  queryRunner.runQueries();
}
