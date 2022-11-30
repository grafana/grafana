import React, { useEffect, useMemo } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorSwitch } from '@grafana/experimental';
import { Select } from '@grafana/ui';

import { STATISTICS } from '../../cloudwatch-sql/language';
import { CloudWatchDatasource } from '../../datasource';
import { useDimensionKeys, useMetrics, useNamespaces } from '../../hooks';
import { CloudWatchMetricsQuery } from '../../types';
import { appendTemplateVariables } from '../../utils/utils';

import {
  getMetricNameFromExpression,
  getNamespaceFromExpression,
  getSchemaLabelKeys as getSchemaLabels,
  isUsingWithSchema,
  removeMetricName,
  setAggregation,
  setMetricName,
  setNamespace,
  setSchemaLabels,
  setWithSchema,
  stringArrayToDimensions,
} from './utils';

interface SQLBuilderSelectRowProps {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  onQueryChange: (query: CloudWatchMetricsQuery) => void;
}

const AGGREGATIONS = STATISTICS.map(toOption);

const SQLBuilderSelectRow: React.FC<SQLBuilderSelectRowProps> = ({ datasource, query, onQueryChange }) => {
  const sql = query.sql ?? {};

  const aggregation = sql.select?.name;
  useEffect(() => {
    if (!aggregation) {
      onQueryChange(setAggregation(query, STATISTICS[0]));
    }
  }, [aggregation, onQueryChange, query]);

  const metricName = getMetricNameFromExpression(sql.select);
  const namespace = getNamespaceFromExpression(sql.from);
  const schemaLabels = getSchemaLabels(sql.from);
  const withSchemaEnabled = isUsingWithSchema(sql.from);

  const namespaceOptions = useNamespaces(datasource);
  const metricOptions = useMetrics(datasource, { region: query.region, namespace });
  const existingFilters = useMemo(() => stringArrayToDimensions(schemaLabels ?? []), [schemaLabels]);
  const unusedDimensionKeys = useDimensionKeys(datasource, {
    region: query.region,
    namespace,
    metricName,
    dimensionFilters: existingFilters,
  });
  const dimensionKeys = useMemo(
    () => (schemaLabels?.length ? [...unusedDimensionKeys, ...schemaLabels.map(toOption)] : unusedDimensionKeys),
    [unusedDimensionKeys, schemaLabels]
  );

  const onNamespaceChange = async (query: CloudWatchMetricsQuery) => {
    const validatedQuery = await validateMetricName(query);
    onQueryChange(validatedQuery);
  };

  const validateMetricName = async (query: CloudWatchMetricsQuery) => {
    let { region, sql, namespace } = query;
    await datasource.api.getMetrics({ namespace, region }).then((result: Array<SelectableValue<string>>) => {
      if (!result.some((metric) => metric.value === metricName)) {
        sql = removeMetricName(query).sql;
      }
    });
    return { ...query, sql };
  };

  return (
    <>
      <EditorFieldGroup>
        <EditorField label="Namespace" width={16}>
          <Select
            aria-label="Namespace"
            value={namespace ? toOption(namespace) : null}
            inputId={`${query.refId}-cloudwatch-sql-namespace`}
            options={namespaceOptions}
            allowCustomValue
            onChange={({ value }) => value && onNamespaceChange(setNamespace(query, value))}
          />
        </EditorField>

        <EditorField label="With schema">
          <EditorSwitch
            id={`${query.refId}-cloudwatch-sql-withSchema`}
            value={withSchemaEnabled}
            onChange={(ev) =>
              ev.target instanceof HTMLInputElement && onQueryChange(setWithSchema(query, ev.target.checked))
            }
          />
        </EditorField>

        {withSchemaEnabled && (
          <EditorField label="Schema labels" disabled={!namespace}>
            <Select
              id={`${query.refId}-cloudwatch-sql-schema-label-keys`}
              width="auto"
              isMulti={true}
              value={schemaLabels ? schemaLabels.map(toOption) : null}
              options={dimensionKeys}
              allowCustomValue
              onChange={(item) => item && onQueryChange(setSchemaLabels(query, item))}
            />
          </EditorField>
        )}
      </EditorFieldGroup>

      <EditorFieldGroup>
        <EditorField label="Metric name" width={16}>
          <Select
            aria-label="Metric name"
            value={metricName ? toOption(metricName) : null}
            options={metricOptions}
            allowCustomValue
            onChange={({ value }) => value && onQueryChange(setMetricName(query, value))}
          />
        </EditorField>

        <EditorField label="Aggregation" width={16}>
          <Select
            aria-label="Aggregation"
            value={aggregation ? toOption(aggregation) : null}
            options={appendTemplateVariables(datasource, AGGREGATIONS)}
            onChange={({ value }) => value && onQueryChange(setAggregation(query, value))}
          />
        </EditorField>
      </EditorFieldGroup>
    </>
  );
};

export default SQLBuilderSelectRow;
