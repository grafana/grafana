import { useMemo } from 'react';

import { FieldType, LoadingState, type TimeRange, createDataFrame } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
} from '@grafana/scenes';
import { GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { getGrafanaInstancesByStateScene } from '../../insights/grafana/AlertsByStateScene';
import { getGrafanaEvalSuccessVsFailuresScene } from '../../insights/grafana/EvalSuccessVsFailuresScene';
import { getGrafanaMissedIterationsScene } from '../../insights/grafana/MissedIterationsScene';
import { getGrafanaRulesByEvaluationScene } from '../../insights/grafana/RulesByEvaluation';
import { INSTANCE_ID, PANEL_STYLES } from '../Insights';

import { type DeliveryOverTime } from './deliverySummary';
import { toSceneRange } from './homeRange';
import { USAGE_DATA_SOURCE, buildAlertmanagerQueries } from './usageHistory';

export type UsageChartKind =
  | 'instances'
  | 'rules-evaluating'
  | 'evaluation-success'
  | 'missed'
  | 'alertmanager-alerts'
  | 'silences';

/** One chart from the Grafana Cloud usage metrics, for the selected range. */
export function UsageChart({ kind, range }: { kind: UsageChartKind; range: TimeRange }) {
  const scene = useMemo(() => chartScene(buildUsageChart(kind), range), [kind, range]);
  return <scene.Component model={scene} />;
}

/** Sent and failed notification attempts over the range, from notification history. */
export function DeliveryOverTimeChart({ overTime, range }: { overTime: DeliveryOverTime; range: TimeRange }) {
  const scene = useMemo(() => {
    const frame = createDataFrame({
      fields: [
        // Notification history returns epoch seconds; the chart needs milliseconds.
        { name: 'Time', type: FieldType.time, values: overTime.times.map((time) => time * 1000) },
        { name: 'sent', type: FieldType.number, values: overTime.sent },
        { name: 'failed', type: FieldType.number, values: overTime.failed },
      ],
    });
    const data = new SceneDataNode({ data: { series: [frame], state: LoadingState.Done, timeRange: range } });
    const panel = PanelBuilders.timeseries()
      .setTitle(t('alerting.home.details.delivery-over-time', 'Delivery over time'))
      .setDescription(
        t('alerting.home.details.delivery-over-time-description', 'Notification attempts, sent and failed')
      )
      .setData(data)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOverrides((overrides) =>
        overrides
          .matchFieldsWithName('sent')
          .overrideColor({ mode: 'fixed', fixedColor: 'green' })
          .matchFieldsWithName('failed')
          .overrideColor({ mode: 'fixed', fixedColor: 'red' })
      )
      .build();
    return chartScene(new SceneFlexItem({ ...PANEL_STYLES, body: panel }), range);
  }, [overTime, range]);

  return <scene.Component model={scene} />;
}

function buildUsageChart(kind: UsageChartKind): SceneFlexItem {
  switch (kind) {
    case 'instances':
      return getGrafanaInstancesByStateScene(
        USAGE_DATA_SOURCE,
        t('alerting.home.details.instances-over-time', 'Alert instances over time')
      );
    case 'rules-evaluating':
      return getGrafanaRulesByEvaluationScene(
        USAGE_DATA_SOURCE,
        t('alerting.home.details.rules-evaluating', 'Rules evaluating')
      );
    case 'evaluation-success':
      return getGrafanaEvalSuccessVsFailuresScene(
        USAGE_DATA_SOURCE,
        t('alerting.home.details.evaluation-success', 'Evaluation success vs failures')
      );
    case 'missed':
      return getGrafanaMissedIterationsScene(
        USAGE_DATA_SOURCE,
        t('alerting.home.details.missed-evaluations', 'Missed evaluations per rule')
      );
    case 'alertmanager-alerts':
      return stateChart(
        buildAlertmanagerQueries(INSTANCE_ID).alerts,
        t('alerting.home.details.alertmanager-alerts', 'Alerts in the Alertmanager by state'),
        t('alerting.home.details.alertmanager-alerts-description', 'Alerts the Alertmanager holds, by state')
      );
    case 'silences':
      return stateChart(
        buildAlertmanagerQueries(INSTANCE_ID).silences,
        t('alerting.home.details.silences', 'Silences'),
        t('alerting.home.details.silences-description', 'Silences in the Alertmanager, by state')
      );
  }
}

/** A time series of one query broken down by its state label, like the Insights Alertmanager panels. */
function stateChart(expr: string, title: string, description: string): SceneFlexItem {
  const query = new SceneQueryRunner({
    datasource: USAGE_DATA_SOURCE,
    queries: [{ refId: 'A', expr, range: true, legendFormat: '{{state}}' }],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(title)
      .setDescription(description)
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .build(),
  });
}

function chartScene(item: SceneFlexItem, range: TimeRange) {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange(toSceneRange(range)),
    body: new SceneFlexLayout({ children: [item] }),
  });
}
