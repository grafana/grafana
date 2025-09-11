import { omit } from 'lodash';
import { useMemo } from 'react';

import { DataFrame, Labels, findCommonLabels } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useQueryRunner, useTimeRange } from '@grafana/scenes-react';

import { useWorkbenchContext } from '../WorkbenchContext';
import { METRIC_NAME } from '../constants';
import { GenericRow } from '../rows/GenericRow';
import { InstanceRow } from '../rows/InstanceRow';

import { getDataQuery } from './utils';

function extractInstancesFromData(series: DataFrame[] | undefined) {
  if (!series) {
    return [];
  }

  // 1. Group series by labels, ignoring alertstate
  const groups = new Map<string, { labels: Labels; series: DataFrame[] }>();
  series.forEach((series) => {
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
}

export function AlertRuleInstances({ ruleUID }: { ruleUID: string }) {
  const { leftColumnWidth } = useWorkbenchContext();
  const [timeRange] = useTimeRange();

  const query = getDataQuery(
    `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${METRIC_NAME}{grafana_rule_uid="${ruleUID}"})`,
    { format: 'timeseries', legendFormat: '{{alertstate}}' }
  );

  const queryRunner = useQueryRunner({ queries: [query] });

  const isLoading = !queryRunner.isDataReadyToDisplay();
  const { data } = queryRunner.useState();

  const instances = useMemo(() => extractInstancesFromData(data?.series), [data]);

  if (!instances.length && !isLoading) {
    return (
      <GenericRow
        width={leftColumnWidth}
        title={<Trans i18nKey="alerting.triage.alert-instances">Alert instances</Trans>}
      >
        <div>
          <Trans i18nKey="alerting.triage.no-instances-found">No alert instances found for rule: {ruleUID}</Trans>
        </div>
      </GenericRow>
    );
  }

  const allSeriesLabels: Labels[] = instances.map((instance) => instance.labels);
  const commonLabels = allSeriesLabels.length === 1 ? {} : findCommonLabels(allSeriesLabels);

  return (
    <>
      {instances.map((instance) => (
        <InstanceRow
          key={JSON.stringify(instance.labels)}
          instance={instance}
          commonLabels={commonLabels}
          leftColumnWidth={leftColumnWidth}
          timeRange={timeRange}
        />
      ))}
    </>
  );
}
