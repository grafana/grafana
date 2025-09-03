import { omit } from 'lodash';
import { useMemo } from 'react';

import { DataFrame, Labels, LoadingState, findCommonLabels } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneDataNode, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useQueryRunner, useTimeRange } from '@grafana/scenes-react';
import {
  AxisPlacement,
  GraphDrawStyle,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { AlertLabels } from '../../components/AlertLabels';
import { overrideToFixedColor } from '../../home/Insights';
import { GroupRow } from '../GroupRow';
import { useWorkbenchContext } from '../WorkbenchContext';

import { DEFAULT_FIELDS, METRIC_NAME, getDataQuery } from './utils';

const barChartConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
  .setCustomFieldConfig('lineInterpolation', LineInterpolation.StepBefore)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('fillOpacity', 50)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
  .setCustomFieldConfig('axisGridShow', false)
  .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setMin(0)
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('firing')
      .overrideColor(overrideToFixedColor('firing'))
      .matchFieldsWithName('pending')
      .overrideColor(overrideToFixedColor('pending'))
  )
  .build();

export function AlertRuleDetails({ ruleUID }: { ruleUID: string }) {
  const { leftColumnWidth } = useWorkbenchContext();
  const [timeRange] = useTimeRange();

  const query = getDataQuery(
    `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${METRIC_NAME}{grafana_rule_uid="${ruleUID}"})`,
    { format: 'timeseries', legendFormat: '{{alertstate}}' }
  );
  const queryRunner = useQueryRunner({ queries: [query] });
  const { data } = queryRunner.useState();

  const instances = useMemo(() => {
    if (!data?.series.length) {
      return [];
    }

    // 1. Group series by labels, ignoring alertstate
    const groups = new Map<string, { labels: Labels; series: DataFrame[] }>();
    data.series.forEach((series) => {
      const valueField = series.fields.find((f) => f.type !== 'time');
      if (!valueField) {
        return;
      }

      const keyLabels = omit(valueField.labels ?? {}, 'alertstate');
      const key = JSON.stringify(keyLabels);

      if (!groups.has(key)) {
        groups.set(key, { labels: keyLabels, series: [] });
      }
      groups.get(key)!.series.push(series);
    });

    return Array.from(groups.values());
  }, [data]);

  if (!instances.length) {
    return (
      <GroupRow
        width={leftColumnWidth}
        title={<Trans i18nKey="alerting.triage.alert-instances">Alert instances</Trans>}
      >
        <div>
          <Trans i18nKey="alerting.triage.no-instances-found">No alert instances found for rule: {ruleUID}</Trans>
        </div>
      </GroupRow>
    );
  }

  const allSeriesLabels: Labels[] = instances.map((instance) => instance.labels);
  const commonLabels = findCommonLabels(allSeriesLabels);

  return (
    <>
      {instances.map((instance) => {
        const dataProvider = new SceneDataNode({
          data: {
            series: instance.series,
            state: LoadingState.Done,
            timeRange,
          },
        });
        const labels = omit(instance.labels, DEFAULT_FIELDS);
        console.log(instance.series);

        return (
          <GroupRow
            key={JSON.stringify(instance.labels)}
            width={leftColumnWidth}
            title={<AlertLabels labels={labels} commonLabels={commonLabels} />}
            content={<VizPanel title="" viz={barChartConfig} dataProvider={dataProvider} displayMode="transparent" />}
          />
        );
      })}
    </>
  );
}
