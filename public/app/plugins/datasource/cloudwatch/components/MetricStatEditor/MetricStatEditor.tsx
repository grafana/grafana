import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows, EditorSwitch } from '@grafana/experimental';
import { Select } from '@grafana/ui';

import { Dimensions } from '..';
import { CloudWatchDatasource } from '../../datasource';
import { useDimensionKeys, useMetrics, useNamespaces } from '../../hooks';
import { standardStatistics } from '../../standardStatistics';
import { MetricStat, AccountInfo } from '../../types';
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
  const { region, namespace } = metricStat;
  const namespaces = useNamespaces(datasource);
  const metrics = useMetrics(datasource, region, namespace);
  const dimensionKeys = useDimensionKeys(datasource, { ...metricStat, dimensionFilters: metricStat.dimensions });

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
        {!disableExpressions && (
          <Account
            query={metricStat}
            onChange={(accountInfo?: AccountInfo) => onMetricStatChange({ ...metricStat, accountInfo })}
            api={datasource.api}
          ></Account>
        )}
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
