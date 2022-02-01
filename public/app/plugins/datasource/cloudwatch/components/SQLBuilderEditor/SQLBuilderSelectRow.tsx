import React, { useEffect, useMemo } from 'react';
import { toOption } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { Select, Switch } from '@grafana/ui';
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
  const metricOptions = useMetrics(datasource, query.region, namespace);
  const existingFilters = useMemo(() => stringArrayToDimensions(schemaLabels ?? []), [schemaLabels]);
  const unusedDimensionKeys = useDimensionKeys(datasource, query.region, namespace, metricName, existingFilters);
  const dimensionKeys = useMemo(
    () => (schemaLabels?.length ? [...unusedDimensionKeys, ...schemaLabels.map(toOption)] : unusedDimensionKeys),
    [unusedDimensionKeys, schemaLabels]
  );

  return (
    <>
      <EditorFieldGroup>
        <EditorField label="Namespace" width={16}>
          <Select
            value={namespace ? toOption(namespace) : null}
            inputId={`${query.refId}-cloudwatch-sql-namespace`}
            options={namespaceOptions}
            allowCustomValue
            onChange={({ value }) => value && onQueryChange(setNamespace(query, value))}
            menuShouldPortal
          />
        </EditorField>

        <EditorField label="With schema">
          <Switch
            id={`${query.refId}-cloudwatch-sql-withSchema`}
            value={withSchemaEnabled}
            onChange={(ev) =>
              ev.target instanceof HTMLInputElement && onQueryChange(setWithSchema(query, ev.target.checked))
            }
          />
        </EditorField>

        {withSchemaEnabled && (
          <EditorField label="Schema labels">
            <Select
              id={`${query.refId}-cloudwatch-sql-schema-label-keys`}
              width="auto"
              isMulti={true}
              disabled={!namespace}
              value={schemaLabels ? schemaLabels.map(toOption) : null}
              options={dimensionKeys}
              allowCustomValue
              onChange={(item) => item && onQueryChange(setSchemaLabels(query, item))}
              menuShouldPortal
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
            menuShouldPortal
          />
        </EditorField>

        <EditorField label="Aggregation" width={16}>
          <Select
            aria-label="Aggregation"
            value={aggregation ? toOption(aggregation) : null}
            options={appendTemplateVariables(datasource, AGGREGATIONS)}
            onChange={({ value }) => value && onQueryChange(setAggregation(query, value))}
            menuShouldPortal
          />
        </EditorField>
      </EditorFieldGroup>
    </>
  );
};

export default SQLBuilderSelectRow;
