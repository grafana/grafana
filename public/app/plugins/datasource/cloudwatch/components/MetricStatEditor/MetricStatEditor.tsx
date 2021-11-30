import React from 'react';
import { Switch, Select } from '@grafana/ui';
import { CloudWatchMetricsQuery } from '../../types';
import { CloudWatchDatasource } from '../../datasource';
import EditorRows from '../ui/EditorRows';
import EditorRow from '../ui/EditorRow';
import EditorFieldGroup from '../ui/EditorFieldGroup';
import EditorField from '../ui/EditorField';
import { appendTemplateVariables, toOption } from '../../utils/utils';
import { useDimensionKeys, useMetrics, useNamespaces } from '../../hooks';
import { Dimensions } from '..';

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

  return (
    <EditorRows>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Namespace" width={26}>
            <Select
              value={query.namespace}
              allowCustomValue
              options={namespaces}
              onChange={({ value: namespace }) => {
                if (namespace) {
                  onQueryChange({ ...query, namespace });
                }
              }}
            />
          </EditorField>
          <EditorField label="Metric name" width={16}>
            <Select
              value={query.metricName}
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
              inputId="metric-stat-editor-select-statistic"
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
            <Switch
              checked={!!query.matchExact}
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
