import React from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { InlineField } from '@grafana/ui';

import { Dimensions } from '..';
import { CloudWatchDatasource } from '../../datasource';
import { useAccountOptions, useDimensionKeys, useMetrics, useNamespaces, useRegions } from '../../hooks';
import { migrateVariableQuery } from '../../migrations/variableQueryMigrations';
import { CloudWatchJsonData, CloudWatchQuery, VariableQuery, VariableQueryType } from '../../types';
import { ALL_ACCOUNTS_OPTION } from '../Account';

import { MultiFilter } from './MultiFilter';
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
  { value: VariableQueryType.LogGroups, label: 'Log Groups' },
  ...(config.featureToggles.cloudWatchCrossAccountQuerying
    ? [{ value: VariableQueryType.Accounts, label: 'Accounts' }]
    : []),
];

export const VariableQueryEditor = ({ query, datasource, onChange }: Props) => {
  const parsedQuery = migrateVariableQuery(query);

  const { region, namespace, metricName, dimensionKey, dimensionFilters } = parsedQuery;
  const [regions, regionIsLoading] = useRegions(datasource);
  const namespaces = useNamespaces(datasource);
  const metrics = useMetrics(datasource, { region, namespace });
  const dimensionKeys = useDimensionKeys(datasource, { region, namespace, metricName });
  const keysForDimensionFilter = useDimensionKeys(datasource, { region, namespace, metricName, dimensionFilters });
  const accountState = useAccountOptions(datasource.resources, query.region);

  const onRegionChange = async (region: string) => {
    const validatedQuery = await sanitizeQuery({
      ...parsedQuery,
      region,
      accountId: undefined,
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
      await datasource.resources.getMetrics({ namespace, region }).then((result: Array<SelectableValue<string>>) => {
        if (!result.find((metric) => metric.value === metricName)) {
          metricName = '';
        }
      });
    }
    if (dimensionKey) {
      await datasource.resources
        .getDimensionKeys({ namespace, region })
        .then((result: Array<SelectableValue<string>>) => {
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
    VariableQueryType.LogGroups,
    VariableQueryType.Accounts,
  ].includes(parsedQuery.queryType);
  const hasAccountIDField = [
    VariableQueryType.Metrics,
    VariableQueryType.DimensionKeys,
    VariableQueryType.DimensionValues,
    VariableQueryType.LogGroups,
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
        onChange={(value: VariableQueryType) =>
          onQueryChange({ ...parsedQuery, queryType: value, accountId: undefined })
        }
        label="Query type"
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
      {hasAccountIDField &&
        accountState.value &&
        accountState.value?.length > 0 &&
        config.featureToggles.cloudWatchCrossAccountQuerying && (
          <VariableQueryField
            label="Account"
            value={query.accountId ?? null}
            onChange={(accountId?: string) => onQueryChange({ ...parsedQuery, accountId })}
            options={[ALL_ACCOUNTS_OPTION, ...accountState?.value]}
            allowCustomValue={false}
          />
        )}
      {hasNamespaceField && (
        <VariableQueryField
          value={namespace}
          options={namespaces}
          onChange={(value: string) => onNamespaceChange(value)}
          label="Namespace"
          inputId={`variable-query-namespace-${query.refId}`}
          allowCustomValue
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
            allowCustomValue
          />
          <VariableQueryField
            value={dimensionKey || null}
            options={dimensionKeys}
            onChange={(value: string) => onQueryChange({ ...parsedQuery, dimensionKey: value })}
            label="Dimension key"
            inputId={`variable-query-dimension-key-${query.refId}`}
            allowCustomValue
          />
          <InlineField label="Dimensions" labelWidth={20} shrink tooltip="Dimensions to filter the returned values on">
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
            onBlur={(value: string) => onQueryChange({ ...parsedQuery, attributeName: value })}
            label="Attribute name"
            interactive={true}
            tooltip={
              <>
                {'Attribute or tag to query on. Tags should be formatted "Tags.<name>". '}
                <a
                  href="https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/template-queries-cloudwatch/#selecting-attributes"
                  target="_blank"
                  rel="noreferrer"
                >
                  See the documentation for more details
                </a>
              </>
            }
          />
          <InlineField
            label="Filters"
            labelWidth={20}
            shrink
            tooltip={
              <>
                <a
                  href="https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/template-queries-cloudwatch/#selecting-attributes"
                  target="_blank"
                  rel="noreferrer"
                >
                  Pre-defined ec2:DescribeInstances filters/tags
                </a>
                {' and the values to filter on. Tags should be formatted tag:<name>.'}
              </>
            }
          >
            <MultiFilter
              filters={parsedQuery.ec2Filters}
              onChange={(filters) => {
                onChange({ ...parsedQuery, ec2Filters: filters });
              }}
              keyPlaceholder="filter/tag"
            />
          </InlineField>
        </>
      )}
      {parsedQuery.queryType === VariableQueryType.ResourceArns && (
        <>
          <VariableTextField
            value={parsedQuery.resourceType}
            onBlur={(value: string) => onQueryChange({ ...parsedQuery, resourceType: value })}
            label="Resource type"
          />
          <InlineField label="Tags" shrink labelWidth={20} tooltip="Tags to filter the returned values on.">
            <MultiFilter
              filters={parsedQuery.tags}
              onChange={(filters) => {
                onChange({ ...parsedQuery, tags: filters });
              }}
              keyPlaceholder="tag"
            />
          </InlineField>
        </>
      )}
      {parsedQuery.queryType === VariableQueryType.LogGroups && (
        <VariableTextField
          value={query.logGroupPrefix ?? ''}
          onBlur={(value: string) => onQueryChange({ ...parsedQuery, logGroupPrefix: value })}
          label="Log group prefix"
        />
      )}
    </>
  );
};
