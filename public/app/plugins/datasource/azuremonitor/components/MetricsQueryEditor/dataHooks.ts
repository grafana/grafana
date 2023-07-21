import { useEffect, useState } from 'react';

import { rangeUtil } from '@grafana/data';

import Datasource from '../../datasource';
import TimegrainConverter from '../../time_grain_converter';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery, AzureMonitorResource } from '../../types';
import { toOption } from '../../utils/common';
import { useAsyncState } from '../../utils/useAsyncState';

import { setCustomNamespace } from './setQueryValue';

type SetErrorFn = (source: string, error: AzureMonitorErrorish | undefined) => void;

export type DataHook = (
  query: AzureMonitorQuery,
  datasource: Datasource,
  onChange: OnChangeFn,
  setError: SetErrorFn
) => AzureMonitorOption[];

export type MetricsMetadataHook = (
  query: AzureMonitorQuery,
  datasource: Datasource,
  onChange: OnChangeFn
) => MetricMetadata;

export interface MetricMetadata {
  aggOptions: AzureMonitorOption[];
  timeGrains: AzureMonitorOption[];
  dimensions: AzureMonitorOption[];
  isLoading: boolean;

  // These two properties are only used within the hook, and not elsewhere
  supportedAggTypes: string[];
  primaryAggType: string | undefined;
}

type OnChangeFn = (newQuery: AzureMonitorQuery) => void;

const getResourceGroupAndName = (resources?: AzureMonitorResource[]) => {
  if (!resources || !resources.length) {
    return { resourceGroup: '', resourceName: '' };
  }
  return {
    resourceGroup: resources[0].resourceGroup ?? '',
    resourceName: resources[0].resourceName ?? '',
  };
};

export const useMetricNamespaces: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { metricNamespace, resources } = query.azureMonitor ?? {};
  const { resourceGroup, resourceName } = getResourceGroupAndName(resources);

  const metricNamespaces = useAsyncState(
    async () => {
      if (!subscription || !resourceGroup || !resourceName) {
        return;
      }

      const results = await datasource.azureMonitorDatasource.getMetricNamespaces(
        {
          subscription,
          metricNamespace,
          resourceGroup,
          resourceName,
        },
        false
      );
      const options = formatOptions(results, metricNamespace);

      // Do some cleanup of the query state if need be
      if (!metricNamespace && options.length) {
        onChange(setCustomNamespace(query, options[0].value));
      }

      return options;
    },
    setError,
    [subscription, metricNamespace, resourceGroup, resourceName]
  );

  return metricNamespaces;
};

export const useMetricNames: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { metricNamespace, metricName, resources, customNamespace } = query.azureMonitor ?? {};
  const { resourceGroup, resourceName } = getResourceGroupAndName(resources);
  const multipleResources = (resources && resources.length > 1) ?? false;
  const region = query.azureMonitor?.region ?? '';

  return useAsyncState(
    async () => {
      if (!subscription || !metricNamespace || !resourceGroup || !resourceName) {
        return;
      }
      const results = await datasource.azureMonitorDatasource.getMetricNames(
        {
          subscription,
          resourceGroup,
          resourceName,
          metricNamespace,
          customNamespace,
        },
        multipleResources,
        region
      );
      const options = formatOptions(results, metricName);

      return options;
    },
    setError,
    [subscription, resourceGroup, resourceName, metricNamespace, customNamespace, multipleResources]
  );
};

const defaultMetricMetadata: MetricMetadata = {
  aggOptions: [],
  timeGrains: [],
  dimensions: [],
  isLoading: false,
  supportedAggTypes: [],
  primaryAggType: undefined,
};

export const useMetricMetadata = (query: AzureMonitorQuery, datasource: Datasource, onChange: OnChangeFn) => {
  const [metricMetadata, setMetricMetadata] = useState<MetricMetadata>(defaultMetricMetadata);
  const { subscription } = query;
  const { resources, metricNamespace, metricName, aggregation, timeGrain, customNamespace } = query.azureMonitor ?? {};
  const { resourceGroup, resourceName } = getResourceGroupAndName(resources);
  const multipleResources = (resources && resources.length > 1) ?? false;

  // Fetch new metric metadata when the fields change
  useEffect(() => {
    if (!subscription || !resourceGroup || !resourceName || !metricNamespace || !metricName) {
      setMetricMetadata(defaultMetricMetadata);
      return;
    }

    datasource.azureMonitorDatasource
      .getMetricMetadata(
        { subscription, resourceGroup, resourceName, metricNamespace, metricName, customNamespace },
        multipleResources
      )
      .then((metadata) => {
        // TODO: Move the aggregationTypes and timeGrain defaults into `getMetricMetadata`
        const aggregations = (metadata.supportedAggTypes || [metadata.primaryAggType]).map((v) => ({
          label: v,
          value: v,
        }));

        setMetricMetadata({
          aggOptions: aggregations,
          timeGrains: metadata.supportedTimeGrains,
          dimensions: metadata.dimensions,
          isLoading: false,
          supportedAggTypes: metadata.supportedAggTypes ?? [],
          primaryAggType: metadata.primaryAggType,
        });
      });
  }, [
    datasource,
    subscription,
    resourceGroup,
    resourceName,
    metricNamespace,
    metricName,
    customNamespace,
    multipleResources,
  ]);

  // Update the query state in response to the meta data changing
  useEffect(() => {
    const newAggregation = aggregation || metricMetadata.primaryAggType;
    const newTimeGrain = timeGrain || 'auto';

    if (newAggregation !== aggregation || newTimeGrain !== timeGrain) {
      onChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          aggregation: newAggregation,
          timeGrain: newTimeGrain,
          allowedTimeGrainsMs: metricMetadata.timeGrains
            .filter((timeGrain) => timeGrain.value !== 'auto')
            .map((timeGrain) =>
              rangeUtil.intervalToMs(TimegrainConverter.createKbnUnitFromISO8601Duration(timeGrain.value))
            ),
        },
      });
    }
  }, [onChange, metricMetadata, aggregation, timeGrain, query]);

  return metricMetadata;
};

function formatOptions(
  rawResults: Array<{
    text: string;
    value: string;
  }>,
  selectedValue?: string
) {
  const options = rawResults.map(toOption);

  // account for custom values that might have been set in json file like ones crafted with a template variable (ex: "cloud-datasource-resource-$Environment")
  if (selectedValue && !options.find((option) => option.value === selectedValue.toLowerCase())) {
    options.push({ label: selectedValue, value: selectedValue });
  }

  return options;
}
