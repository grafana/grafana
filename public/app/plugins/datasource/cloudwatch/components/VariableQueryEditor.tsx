import React from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { VariableQueryField, VariableTextField } from '.';
import { CloudWatchDatasource } from '../datasource';
import { useDimensionKeys, useMetrics, useNamespaces, useRegions } from '../hooks';
import { CloudWatchJsonData, CloudWatchQuery, VariableQuery, VariableQueryType } from '../types';
import { migrateVariableQuery } from '../migrations';

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

const VariableQueryEditor = ({ query, datasource, onChange }: Props) => {
  query = migrateVariableQuery(query);
  if (!query.queryType) {
    query.queryType = VariableQueryType.Regions;
  }

  const { region, namespace, metricName, dimensionKey } = query;
  const [regions, regionIsLoading] = useRegions(datasource);
  const namespaces = useNamespaces(datasource);
  const metrics = useMetrics(datasource, region, namespace);
  const dimensionKeys = useDimensionKeys(datasource, region, namespace, metricName);

  const onRegionChange = async (region: string) => {
    const validatedQuery = await validateQuery({
      ...query,
      region,
    });
    onQueryChange(validatedQuery);
  };

  const onNamespaceChange = async (namespace: string) => {
    const validatedQuery = await validateQuery({
      ...query,
      namespace,
    });
    onQueryChange(validatedQuery);
  };

  const onQueryChange = (newQuery: VariableQuery) => {
    onChange({ ...newQuery, refId: 'CloudWatchVariableQueryEditor-VariableQuery' });
  };

  // Reset dimensionValue parameters if namespace or region change
  const validateQuery = async (query: VariableQuery) => {
    let { metricName, dimensionKey, dimensionFilters, namespace, region } = query;
    if (metricName) {
      await datasource.getMetrics(namespace, region).then((result: Array<SelectableValue<string>>) => {
        if (!result.find((metric) => metric.value === metricName)) {
          metricName = '';
          dimensionFilters = '';
        }
      });
    }
    if (dimensionKey) {
      await datasource.getDimensionKeys(namespace, region).then((result: Array<SelectableValue<string>>) => {
        if (!result.find((key) => key.value === dimensionKey)) {
          dimensionKey = '';
          dimensionFilters = '';
        }
      });
    }
    return { ...query, metricName, dimensionKey, dimensionFilters };
  };

  const renderQueryTypeSwitch = (queryType: string) => {
    switch (queryType) {
      case VariableQueryType.Metrics:
      case VariableQueryType.DimensionKeys:
        return (
          <>
            <VariableQueryField
              value={region}
              options={regions}
              onChange={(value: string) => onRegionChange(value)}
              label="Region"
              isLoading={regionIsLoading}
            />
            <VariableQueryField
              value={namespace}
              options={namespaces}
              onChange={(value: string) => onNamespaceChange(value)}
              label="Namespace"
            />
          </>
        );
      case VariableQueryType.DimensionValues:
        return (
          <>
            <VariableQueryField
              value={region}
              options={regions}
              onChange={(value: string) => onRegionChange(value)}
              label="Region"
              isLoading={regionIsLoading}
            />
            <VariableQueryField
              value={namespace}
              options={namespaces}
              onChange={(value: string) => onNamespaceChange(value)}
              label="Namespace"
            />
            <VariableQueryField
              value={metricName || null}
              options={metrics}
              onChange={(value: string) => onQueryChange({ ...query, metricName: value })}
              label="Metric"
            />
            <VariableQueryField
              value={dimensionKey || null}
              options={dimensionKeys}
              onChange={(value: string) => onQueryChange({ ...query, dimensionKey: value })}
              label="Dimension Key"
            />
            <VariableTextField
              value={query.dimensionFilters}
              placeholder="{key:[value]}"
              onBlur={(value: string) => onQueryChange({ ...query, dimensionFilters: value })}
              label="Filters"
            />
          </>
        );
      case VariableQueryType.EBSVolumeIDs:
        return (
          <>
            <VariableQueryField
              value={region}
              options={regions}
              onChange={(value: string) => onRegionChange(value)}
              label="Region"
              isLoading={regionIsLoading}
            />
            <VariableTextField
              value={query.instanceID}
              placeholder="i-XXXXXXXXXXXXXXXXX"
              onBlur={(value: string) => onQueryChange({ ...query, instanceID: value })}
              label="Instance ID"
            />
          </>
        );
      case VariableQueryType.EC2InstanceAttributes:
        return (
          <>
            <VariableQueryField
              value={region}
              options={regions}
              onChange={(value: string) => onRegionChange(value)}
              label="Region"
              isLoading={regionIsLoading}
            />
            <VariableTextField
              value={query.attributeName}
              placeholder="attribute name"
              onBlur={(value: string) => onQueryChange({ ...query, attributeName: value })}
              label="Attribute Name"
            />
            <VariableTextField
              value={query.ec2Filters}
              placeholder="{key:[value]}"
              onBlur={(value: string) => onQueryChange({ ...query, ec2Filters: value })}
              label="Filters"
            />
          </>
        );
      case VariableQueryType.ResourceArns:
        return (
          <>
            <VariableQueryField
              value={region}
              options={regions}
              onChange={(value: string) => onRegionChange(value)}
              label="Region"
              isLoading={regionIsLoading}
            />
            <VariableTextField
              value={query.resourceType}
              placeholder="resource type"
              onBlur={(value: string) => onQueryChange({ ...query, resourceType: value })}
              label="Resource Type"
            />
            <VariableTextField
              value={query.tags}
              placeholder="{tag:[value]}"
              onBlur={(value: string) => onQueryChange({ ...query, tags: value })}
              label="Tags"
            />
          </>
        );
      default:
        return '';
    }
  };

  return (
    <>
      <VariableQueryField
        value={query.queryType}
        options={queryTypes}
        onChange={(value: string) => onQueryChange({ ...query, queryType: value })}
        label="Query Type"
      />
      {renderQueryTypeSwitch(query.queryType)}
    </>
  );
};

export default VariableQueryEditor;
