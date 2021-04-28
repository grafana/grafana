import { useState, useEffect, useRef } from 'react';

import Datasource from '../datasource';
import { AzureMonitorOption, AzureMonitorQuery } from '../types';
import { convertTimeGrainsToMs, toOption } from '../utils/common';

export interface MetricMetadata {
  aggOptions: Array<{ label: string; value: string }>;
  timeGrains: Array<{ label: string; value: string }>;
  dimensions: Array<{ label: string; value: string }>;
  isLoading: boolean;
}

export function useMetricsMetadata(
  datasource: Datasource,
  query: AzureMonitorQuery,
  subscriptionId: string,
  onQueryChange: (newQuery: AzureMonitorQuery) => void
) {
  const [metricMetadata, setMetricMetadata] = useState<MetricMetadata>({
    aggOptions: [],
    timeGrains: [],
    dimensions: [],
    isLoading: true,
  });

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
              query.azureMonitor.aggregation && metadata.supportedAggTypes.includes(query.azureMonitor.aggregation)
                ? query.azureMonitor.aggregation
                : metadata.primaryAggType,
            timeGrain: query.azureMonitor.timeGrain || 'auto',
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
    query.azureMonitor.resourceGroup,
    query.azureMonitor.metricDefinition,
    query.azureMonitor.resourceName,
    query.azureMonitor.metricNamespace,
    query.azureMonitor.metricName,
    query,
    datasource,
    onQueryChange,
  ]);

  return metricMetadata;
}

export function useMetricDropdownOptions(
  fetchFn: (...args: string[]) => Promise<Array<{ text: string; value: string }>>,
  fetchArgs: Array<string | undefined>,
  setError: (source: string, error: Error | undefined) => void,
  errorSource: string,
  afterSuccessfulFetch?: (results: Array<{ text: string; value: string }>) => void
): [Array<AzureMonitorOption<string>>, boolean] {
  const [metricOptions, setMetricOptions] = useState<AzureMonitorOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchedWith = useRef('');

  useEffect(() => {
    const allArgsTruthy = fetchArgs.every((arg) => !!arg);
    const argsHaveChanged = fetchArgs.toString() !== lastFetchedWith.current;
    const shouldFetch = allArgsTruthy && argsHaveChanged;
    if (!shouldFetch) {
      return;
    }

    setIsLoading(true);
    lastFetchedWith.current = fetchArgs.toString();
    fetchFn(...(fetchArgs as string[]))
      .then((results) => {
        if (afterSuccessfulFetch) {
          afterSuccessfulFetch(results);
        }
        return results;
      })
      .then((results) => {
        setMetricOptions(results.map(toOption));
        setError(errorSource, undefined);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(errorSource, err);
        setIsLoading(false);
      });
  }, [fetchFn, fetchArgs, lastFetchedWith, afterSuccessfulFetch, setError, errorSource]);

  return [metricOptions, isLoading];
}
