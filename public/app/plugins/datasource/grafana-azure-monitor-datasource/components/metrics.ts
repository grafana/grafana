import { useState, useEffect } from 'react';
import Datasource from '../datasource';
import { AzureMonitorQuery } from '../types';
import { convertTimeGrainsToMs } from './common';

export interface MetricMetadata {
  aggOptions: string[];
  timeGrains: Array<{ text: string; value: string }>;
  dimensions: Array<{ text: string; value: string }>;
}

export function useMetricsMetadata(
  datasource: Datasource,
  query: AzureMonitorQuery,
  subscriptionId: string,
  onQueryChange: (newQuery: AzureMonitorQuery) => void
) {
  const [metricMetadata, setMetricMetadata] = useState<MetricMetadata>();

  useEffect(() => {
    if (
      !(
        subscriptionId &&
        query.azureMonitor.resourceGroup &&
        query.azureMonitor.metricDefinition &&
        query.azureMonitor.resourceName &&
        query.azureMonitor.metricNamespace &&
        query.azureMonitor.metricName
      )
    ) {
      return;
    }

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
            aggregation: metadata.primaryAggType,
            timeGrain: 'auto',
            allowedTimeGrainsMs: convertTimeGrainsToMs(metadata.supportedTimeGrains || []),
          },
        });

        setMetricMetadata({
          aggOptions: metadata.supportedAggTypes || [metadata.primaryAggType],
          timeGrains: [{ text: 'auto', value: 'auto' }].concat(metadata.supportedTimeGrains),
          dimensions: metadata.dimensions,
        });
      })
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [
    subscriptionId,
    query.azureMonitor.resourceGroup,
    query.azureMonitor.metricDefinition,
    query.azureMonitor.resourceName,
    query.azureMonitor.metricNamespace,
    query.azureMonitor.metricName,
  ]);

  return metricMetadata;
}
