import React, { useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows, EditorSwitch } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Select } from '@grafana/ui';

import { Dimensions } from '..';
import { CloudWatchDatasource } from '../../datasource';
import { useAccountOptions, useDimensionKeys, useMetrics, useNamespaces } from '../../hooks';
import { standardStatistics } from '../../standardStatistics';
import { MetricStat } from '../../types';
import { appendTemplateVariables, toOption } from '../../utils/utils';
import { Account } from '../Account';

export type Props = {
  refId: string;
  metricStat: MetricStat;
  datasource: CloudWatchDatasource;
  disableExpressions?: boolean;
  onChange: (value: MetricStat) => void;
  onRunQuery: () => void;
};

export function MetricStatEditor({
  refId,
  metricStat,
  datasource,
  disableExpressions = false,
  onChange,
  onRunQuery,
}: React.PropsWithChildren<Props>) {
  const namespaces = useNamespaces(datasource);
  const metrics = useMetrics(datasource, metricStat);
  const dimensionKeys = useDimensionKeys(datasource, { ...metricStat, dimensionFilters: metricStat.dimensions });
  const accountState = useAccountOptions(datasource.api, metricStat.region);

  useEffect(() => {
    datasource.api.isMonitoringAccount(metricStat.region).then((isMonitoringAccount) => {
      if (isMonitoringAccount && !accountState.loading && accountState.value?.length && !metricStat.accountId) {
        onChange({ ...metricStat, accountId: 'all' });
      }

      if (!accountState.loading && accountState.value && !accountState.value.length && metricStat.accountId) {
        onChange({ ...metricStat, accountId: undefined });
      }
    });
  }, [accountState, metricStat, onChange, datasource.api]);

  const onMetricStatChange = (metricStat: MetricStat) => {
    onChange(metricStat);
    onRunQuery();
  };

  const onNamespaceChange = async (metricStat: MetricStat) => {
    const validatedQuery = await validateMetricName(metricStat);
    onMetricStatChange(validatedQuery);
  };

  const validateMetricName = async (metricStat: MetricStat) => {
    let { metricName, namespace, region } = metricStat;
    if (!metricName) {
      return metricStat;
    }
    await datasource.api.getMetrics({ namespace, region }).then((result: Array<SelectableValue<string>>) => {
      if (!result.find((metric) => metric.value === metricName)) {
        metricName = '';
      }
    });
    return { ...metricStat, metricName };
  };

  return (
    <EditorRows>
      <EditorRow>
        {!disableExpressions && config.featureToggles.cloudWatchCrossAccountQuerying && (
          <Account
            accountId={metricStat.accountId}
            onChange={(accountId?: string) => {
              onChange({ ...metricStat, accountId });
              onRunQuery();
            }}
            accountOptions={accountState?.value || []}
          ></Account>
        )}
        <EditorFieldGroup>
          <EditorField label="Namespace" width={26}>
            <Select
              aria-label="Namespace"
              value={metricStat?.namespace && toOption(metricStat.namespace)}
              allowCustomValue
              options={namespaces}
              onChange={({ value: namespace }) => {
                if (namespace) {
                  onNamespaceChange({ ...metricStat, namespace });
                }
              }}
            />
          </EditorField>
          <EditorField label="Metric name" width={16}>
            <Select
              aria-label="Metric name"
              value={metricStat?.metricName && toOption(metricStat.metricName)}
              allowCustomValue
              options={metrics}
              onChange={({ value: metricName }) => {
                if (metricName) {
                  onMetricStatChange({ ...metricStat, metricName });
                }
              }}
            />
          </EditorField>

          <EditorField label="Statistic" width={16}>
            <Select
              inputId={`${refId}-metric-stat-editor-select-statistic`}
              allowCustomValue
              value={toOption(metricStat.statistic ?? standardStatistics[0])}
              options={appendTemplateVariables(
                datasource,
                standardStatistics.filter((s) => s !== metricStat.statistic).map(toOption)
              )}
              onChange={({ value: statistic }) => {
                if (
                  !statistic ||
                  (!standardStatistics.includes(statistic) &&
                    !/^p\d{2}(?:\.\d{1,2})?$/.test(statistic) &&
                    !statistic.startsWith('$'))
                ) {
                  return;
                }

                onMetricStatChange({ ...metricStat, statistic });
              }}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <EditorField label="Dimensions">
          <Dimensions
            metricStat={metricStat}
            onChange={(dimensions) => onMetricStatChange({ ...metricStat, dimensions })}
            dimensionKeys={dimensionKeys}
            disableExpressions={disableExpressions}
            datasource={datasource}
          />
        </EditorField>
        {!disableExpressions && (
          <EditorField
            label="Match exact"
            optional={true}
            tooltip="Only show metrics that exactly match all defined dimension names."
          >
            <EditorSwitch
              id={`${refId}-cloudwatch-match-exact`}
              value={!!metricStat.matchExact}
              onChange={(e) => {
                onMetricStatChange({
                  ...metricStat,
                  matchExact: e.currentTarget.checked,
                });
              }}
            />
          </EditorField>
        )}
      </EditorRow>
    </EditorRows>
  );
}
