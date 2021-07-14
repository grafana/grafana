import { useState, useEffect } from 'react';

import Datasource from '../datasource';
import { AzureMonitorQuery } from '../types';
import { convertTimeGrainsToMs } from '../utils/common';

export interface MetricMetadata {
  aggOptions: Array<{ label: string; value: string }>;
  timeGrains: Array<{ label: string; value: string }>;
  dimensions: Array<{ label: string; value: string }>;
  isLoading: boolean;
}

export function useMetricsMetadata(
  datasource: Datasource,
  query: AzureMonitorQuery,
  subscriptionId: string | undefined,
  onQueryChange: (newQuery: AzureMonitorQuery) => void
) {
  const [metricMetadata, setMetricMetadata] = useState<MetricMetadata>({
    aggOptions: [],
    timeGrains: [],
    dimensions: [],
    isLoading: false,
  });

  useEffect(() => {
    if (
      !(
        subscriptionId &&
        query.azureMonitor &&
        query.azureMonitor.resourceGroup &&
        query.azureMonitor.metricDefinition &&
        query.azureMonitor.resourceName &&
        query.azureMonitor.metricNamespace &&
        query.azureMonitor.metricName
      )
    ) {
      return;
    }
    setMetricMetadata((prevState) => ({ ...prevState, isLoading: true }));
    datasource
      .getMetricMetadata(
        subscriptionId,
        query.azureMonitor.resourceGroup,
        query.azureMonitor.metricDefinition,
        query.azureMonitor.resourceName,
        query.azureMonitor.metricNamespace,
        query.azureMonitor.metricName
      )
      .then((metadata) => {
        onQueryChange({
          ...query,
          azureMonitor: {
            ...query.azureMonitor,
            aggregation:
              query.azureMonitor?.aggregation && metadata.supportedAggTypes.includes(query.azureMonitor.aggregation)
                ? query.azureMonitor.aggregation
                : metadata.primaryAggType,
            timeGrain: query.azureMonitor?.timeGrain || 'auto', // TODO: move this default value somewhere better?
            allowedTimeGrainsMs: convertTimeGrainsToMs(metadata.supportedTimeGrains),
          },
        });

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
        });
      })
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [
    subscriptionId,
    query.azureMonitor?.resourceGroup,
    query.azureMonitor?.metricDefinition,
    query.azureMonitor?.resourceName,
    query.azureMonitor?.metricNamespace,
    query.azureMonitor?.metricName,
    query,
    datasource,
    onQueryChange,
  ]);

  return metricMetadata;
}
