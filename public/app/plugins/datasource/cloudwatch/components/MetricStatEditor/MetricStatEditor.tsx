import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows, EditorSwitch } from '@grafana/experimental';
import { Select } from '@grafana/ui';

import { Dimensions } from '..';
import { CloudWatchDatasource } from '../../datasource';
import { useDimensionKeys, useMetrics, useNamespaces } from '../../hooks';
import { CloudWatchMetricsQuery } from '../../types';
import { appendTemplateVariables, toOption } from '../../utils/utils';

export type Props = {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  disableExpressions?: boolean;
  onChange: (value: CloudWatchMetricsQuery) => void;
  onRunQuery: () => void;
};

export function MetricStatEditor({
  query,
  datasource,
  disableExpressions = false,
  onChange,
  onRunQuery,
}: React.PropsWithChildren<Props>) {
  const { region, namespace, metricName, dimensions } = query;
  const namespaces = useNamespaces(datasource);
  const metrics = useMetrics(datasource, region, namespace);
  const dimensionKeys = useDimensionKeys(datasource, region, namespace, metricName, dimensions ?? {});

  const onQueryChange = (query: CloudWatchMetricsQuery) => {
    onChange(query);
    onRunQuery();
  };

  const onNamespaceChange = async (query: CloudWatchMetricsQuery) => {
    const validatedQuery = await validateMetricName(query);
    onQueryChange(validatedQuery);
  };

  const validateMetricName = async (query: CloudWatchMetricsQuery) => {
    let { metricName, namespace, region } = query;
    if (!metricName) {
      return query;
    }
    await datasource.getMetrics(namespace, region).then((result: Array<SelectableValue<string>>) => {
      if (!result.find((metric) => metric.value === metricName)) {
        metricName = '';
      }
    });
    return { ...query, metricName };
  };

  return (
    <EditorRows>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Namespace" width={26}>
            <Select
              aria-label="Namespace"
              value={query.namespace}
              allowCustomValue
              options={namespaces}
              onChange={({ value: namespace }) => {
                if (namespace) {
                  onNamespaceChange({ ...query, namespace });
                }
              }}
            />
          </EditorField>
          <EditorField label="Metric name" width={16}>
            <Select
              aria-label="Metric name"
              value={query.metricName || null}
              allowCustomValue
              options={metrics}
              onChange={({ value: metricName }) => {
                if (metricName) {
                  onQueryChange({ ...query, metricName });
                }
              }}
            />
          </EditorField>

          <EditorField label="Statistic" width={16}>
            <Select
              inputId={`${query.refId}-metric-stat-editor-select-statistic`}
              allowCustomValue
              value={toOption(query.statistic ?? datasource.standardStatistics[0])}
              options={appendTemplateVariables(
                datasource,
                datasource.standardStatistics.filter((s) => s !== query.statistic).map(toOption)
              )}
              onChange={({ value: statistic }) => {
                if (
                  !statistic ||
                  (!datasource.standardStatistics.includes(statistic) &&
                    !/^p\d{2}(?:\.\d{1,2})?$/.test(statistic) &&
                    !statistic.startsWith('$'))
                ) {
                  return;
                }

                onQueryChange({ ...query, statistic });
              }}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <EditorField label="Dimensions">
          <Dimensions
            query={query}
            onChange={(dimensions) => onQueryChange({ ...query, dimensions })}
            dimensionKeys={dimensionKeys}
            disableExpressions={disableExpressions}
            datasource={datasource}
          />
        </EditorField>
      </EditorRow>
      {!disableExpressions && (
        <EditorRow>
          <EditorField
            label="Match exact"
            optional={true}
            tooltip="Only show metrics that exactly match all defined dimension names."
          >
            <EditorSwitch
              id={`${query.refId}-cloudwatch-match-exact`}
              value={!!query.matchExact}
              onChange={(e) => {
                onQueryChange({
                  ...query,
                  matchExact: e.currentTarget.checked,
                });
              }}
            />
          </EditorField>
        </EditorRow>
      )}
    </EditorRows>
  );
}
