import { useState, useEffect } from 'react';
import Datasource from '../datasource';
import { AzureMonitorQuery } from '../types';
import { convertTimeGrainsToMs, toOption } from './common';

export interface MetricMetadata {
  aggOptions: Array<{ label: string; value: string }>;
  timeGrains: Array<{ label: string; value: string }>;
  dimensions: Array<{ label: string; value: string }>;
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

        // TODO: Move the aggregationTypes and timeGrain defaults into `getMetricMetadata`

        const aggregations = (metadata.supportedAggTypes || [metadata.primaryAggType]).map((v) => ({
          label: v,
          value: v,
        }));

        setMetricMetadata({
          aggOptions: aggregations,
          timeGrains: [{ text: 'auto', value: 'auto' }].concat(metadata.supportedTimeGrains).map(toOption),
          dimensions: metadata.dimensions.map(toOption),
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
