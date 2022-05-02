import React from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField } from '@grafana/ui';

import { Dimensions } from '..';
import { CloudWatchDatasource } from '../../datasource';
import { useDimensionKeys, useMetrics, useNamespaces, useRegions } from '../../hooks';
import { migrateVariableQuery } from '../../migrations';
import { CloudWatchJsonData, CloudWatchQuery, VariableQuery, VariableQueryType } from '../../types';

import { VariableQueryField } from './VariableQueryField';
import { VariableTextField } from './VariableTextField';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData, VariableQuery>;

const queryTypes: Array<{ value: string; label: string }> = [
  { value: VariableQueryType.Regions, label: 'Regions' },
  { value: VariableQueryType.Namespaces, label: 'Namespaces' },
  { value: VariableQueryType.Metrics, label: 'Metrics' },
  { value: VariableQueryType.DimensionKeys, label: 'Dimension Keys' },
  { value: VariableQueryType.DimensionValues, label: 'Dimension Values' },
  { value: VariableQueryType.EBSVolumeIDs, label: 'EBS Volume IDs' },
  { value: VariableQueryType.EC2InstanceAttributes, label: 'EC2 Instance Attributes' },
  { value: VariableQueryType.ResourceArns, label: 'Resource ARNs' },
  { value: VariableQueryType.Statistics, label: 'Statistics' },
];

export const VariableQueryEditor = ({ query, datasource, onChange }: Props) => {
  const parsedQuery = migrateVariableQuery(query);

  const { region, namespace, metricName, dimensionKey, dimensionFilters } = parsedQuery;
  const [regions, regionIsLoading] = useRegions(datasource);
  const namespaces = useNamespaces(datasource);
  const metrics = useMetrics(datasource, region, namespace);
  const dimensionKeys = useDimensionKeys(datasource, region, namespace, metricName);
  const keysForDimensionFilter = useDimensionKeys(datasource, region, namespace, metricName, dimensionFilters ?? {});

  const onRegionChange = async (region: string) => {
    const validatedQuery = await sanitizeQuery({
      ...parsedQuery,
      region,
    });
    onQueryChange(validatedQuery);
  };

  const onNamespaceChange = async (namespace: string) => {
    const validatedQuery = await sanitizeQuery({
      ...parsedQuery,
      namespace,
    });
    onQueryChange(validatedQuery);
  };

  const onQueryChange = (newQuery: VariableQuery) => {
    onChange({
      ...newQuery,
      refId: 'CloudWatchVariableQueryEditor-VariableQuery',
    });
  };

  // Reset dimensionValue parameters if namespace or region change
  const sanitizeQuery = async (query: VariableQuery) => {
    let { metricName, dimensionKey, dimensionFilters, namespace, region } = query;
    if (metricName) {
      await datasource.getMetrics(namespace, region).then((result: Array<SelectableValue<string>>) => {
        if (!result.find((metric) => metric.value === metricName)) {
          metricName = '';
        }
      });
    }
    if (dimensionKey) {
      await datasource.getDimensionKeys(namespace, region).then((result: Array<SelectableValue<string>>) => {
        if (!result.find((key) => key.value === dimensionKey)) {
          dimensionKey = '';
          dimensionFilters = {};
        }
      });
    }
    return { ...query, metricName, dimensionKey, dimensionFilters };
  };

  const hasRegionField = [
    VariableQueryType.Metrics,
    VariableQueryType.DimensionKeys,
    VariableQueryType.DimensionValues,
    VariableQueryType.EBSVolumeIDs,
    VariableQueryType.EC2InstanceAttributes,
    VariableQueryType.ResourceArns,
  ].includes(parsedQuery.queryType);
  const hasNamespaceField = [
    VariableQueryType.Metrics,
    VariableQueryType.DimensionKeys,
    VariableQueryType.DimensionValues,
  ].includes(parsedQuery.queryType);
  return (
    <>
      <VariableQueryField
        value={parsedQuery.queryType}
        options={queryTypes}
        onChange={(value: VariableQueryType) => onQueryChange({ ...parsedQuery, queryType: value })}
        label="Query Type"
        inputId={`variable-query-type-${query.refId}`}
      />
      {hasRegionField && (
        <VariableQueryField
          value={region}
          options={regions}
          onChange={(value: string) => onRegionChange(value)}
          label="Region"
          isLoading={regionIsLoading}
          inputId={`variable-query-region-${query.refId}`}
        />
      )}
      {hasNamespaceField && (
        <VariableQueryField
          value={namespace}
          options={namespaces}
          onChange={(value: string) => onNamespaceChange(value)}
          label="Namespace"
          inputId={`variable-query-namespace-${query.refId}`}
        />
      )}
      {parsedQuery.queryType === VariableQueryType.DimensionValues && (
        <>
          <VariableQueryField
            value={metricName || null}
            options={metrics}
            onChange={(value: string) => onQueryChange({ ...parsedQuery, metricName: value })}
            label="Metric"
            inputId={`variable-query-metric-${query.refId}`}
          />
          <VariableQueryField
            value={dimensionKey || null}
            options={dimensionKeys}
            onChange={(value: string) => onQueryChange({ ...parsedQuery, dimensionKey: value })}
            label="Dimension Key"
            inputId={`variable-query-dimension-key-${query.refId}`}
          />
          <InlineField label="Dimensions" labelWidth={20} tooltip="Dimensions to filter the returned values on">
            <Dimensions
              metricStat={{ ...parsedQuery, dimensions: parsedQuery.dimensionFilters }}
              onChange={(dimensions) => {
                onChange({ ...parsedQuery, dimensionFilters: dimensions });
              }}
              dimensionKeys={keysForDimensionFilter}
              disableExpressions={true}
              datasource={datasource}
            />
          </InlineField>
        </>
      )}
      {parsedQuery.queryType === VariableQueryType.EBSVolumeIDs && (
        <VariableTextField
          value={query.instanceID}
          placeholder="i-XXXXXXXXXXXXXXXXX"
          onBlur={(value: string) => onQueryChange({ ...parsedQuery, instanceID: value })}
          label="Instance ID"
        />
      )}
      {parsedQuery.queryType === VariableQueryType.EC2InstanceAttributes && (
        <>
          <VariableTextField
            value={parsedQuery.attributeName}
            placeholder="attribute name"
            onBlur={(value: string) => onQueryChange({ ...parsedQuery, attributeName: value })}
            label="Attribute Name"
          />
          <VariableTextField
            value={parsedQuery.ec2Filters}
            tooltip='A JSON object representing dimensions/tags and the values to filter on. Ex. { "filter_name": [ "filter_value" ], "tag:name": [ "*" ] }'
            placeholder='{"key":["value"]}'
            onBlur={(value: string) => onQueryChange({ ...parsedQuery, ec2Filters: value })}
            label="Filters"
          />
        </>
      )}
      {parsedQuery.queryType === VariableQueryType.ResourceArns && (
        <>
          <VariableTextField
            value={parsedQuery.resourceType}
            placeholder="resource type"
            onBlur={(value: string) => onQueryChange({ ...parsedQuery, resourceType: value })}
            label="Resource Type"
          />
          <VariableTextField
            value={parsedQuery.tags}
            placeholder='{"tag":["value"]}'
            onBlur={(value: string) => onQueryChange({ ...parsedQuery, tags: value })}
            label="Tags"
          />
        </>
      )}
    </>
  );
};
