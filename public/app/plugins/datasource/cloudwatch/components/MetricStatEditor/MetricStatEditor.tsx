import React, { useEffect } from 'react';

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
};

export function MetricStatEditor({
  refId,
  metricStat,
  datasource,
  disableExpressions = false,
  onChange,
}: React.PropsWithChildren<Props>) {
  const namespaceFieldState = useNamespaces(datasource, metricStat.namespace);
  const metricFieldState = useMetrics(datasource, metricStat, metricStat.metricName);
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

  return (
    <EditorRows>
      <EditorRow>
        {!disableExpressions && config.featureToggles.cloudWatchCrossAccountQuerying && (
          <Account
            accountId={metricStat.accountId}
            onChange={(accountId?: string) => {
              onChange({ ...metricStat, accountId });
            }}
            accountOptions={accountState?.value || []}
          ></Account>
        )}
        <EditorFieldGroup>
          <EditorField label="Namespace" width={26}>
            <Select
              {...namespaceFieldState}
              aria-label="Namespace"
              value={metricStat?.namespace && toOption(metricStat.namespace)}
              allowCustomValue
              onChange={(option) => {
                onChange({ ...metricStat, namespace: option?.value ?? '' });
              }}
            />
          </EditorField>
          <EditorField label="Metric name" width={16}>
            <Select
              {...metricFieldState}
              aria-label="Metric name"
              value={metricStat?.metricName && toOption(metricStat.metricName)}
              allowCustomValue
              onChange={({ value: metricName }) => metricName && onChange({ ...metricStat, metricName })}
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

                onChange({ ...metricStat, statistic });
              }}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <EditorField label="Dimensions">
          <Dimensions
            metricStat={metricStat}
            onChange={(dimensions) => onChange({ ...metricStat, dimensions })}
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
                onChange({
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
