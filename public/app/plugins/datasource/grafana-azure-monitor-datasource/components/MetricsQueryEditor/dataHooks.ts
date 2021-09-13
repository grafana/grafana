import { useState, useEffect, useMemo } from 'react';
import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import { hasOption, toOption } from '../../utils/common';
import { setMetricName, setMetricNamespace } from './setQueryValue';

export interface MetricMetadata {
  aggOptions: AzureMonitorOption[];
  timeGrains: AzureMonitorOption[];
  dimensions: AzureMonitorOption[];
  isLoading: boolean;

  // These two properties are only used within the hook, and not elsewhere
  supportedAggTypes: string[];
  primaryAggType: string | undefined;
}

type SetErrorFn = (source: string, error: AzureMonitorErrorish | undefined) => void;
type OnChangeFn = (newQuery: AzureMonitorQuery) => void;

export type DataHook = (
  query: AzureMonitorQuery,
  datasource: Datasource,
  onChange: OnChangeFn,
  setError: SetErrorFn
) => AzureMonitorOption[];

export function useAsyncState<T>(asyncFn: () => Promise<T>, setError: Function, dependencies: unknown[]) {
  // Use the lazy initial state functionality of useState to assign a random ID to the API call
  // to track where errors come from. See useLastError.
  const [errorSource] = useState(() => Math.random());
  const [value, setValue] = useState<T>();

  const finalValue = useMemo(() => value ?? [], [value]);

  useEffect(() => {
    asyncFn()
      .then((results) => {
        setValue(results);
        setError(errorSource, undefined);
      })
      .catch((err) => {
        setError(errorSource, err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return finalValue;
}

export const useMetricNamespaces: DataHook = (query, datasource, onChange, setError) => {
  const { resource, metricNamespace } = query.azureMonitor ?? {};

  const metricNamespaces = useAsyncState(
    async () => {
      if (!resource) {
        return;
      }

      const results = await datasource.getMetricNamespaces(resource);
      const options = results.map(toOption);

      // Do some cleanup of the query state if need be
      if (!metricNamespace && options.length) {
        onChange(setMetricNamespace(query, options[0].value));
      } else if (options[0] && isInvalidOption(metricNamespace, options, datasource.getVariables())) {
        onChange(setMetricNamespace(query, options[0].value));
      }

      return options;
    },
    setError,
    [resource]
  );

  return metricNamespaces;
};

export const useMetricNames: DataHook = (query, datasource, onChange, setError) => {
  const { resource, metricNamespace, metricName } = query.azureMonitor ?? {};

  return useAsyncState(
    async () => {
      if (!(resource && metricNamespace)) {
        return;
      }

      const results = await datasource.getMetricNames(resource, metricNamespace);
      const options = results.map(toOption);

      if (isInvalidOption(metricName, options, datasource.getVariables())) {
        onChange(setMetricName(query, undefined));
      }

      return options;
    },
    setError,
    [resource, metricNamespace]
  );
};

export const useMetricMetadata = (query: AzureMonitorQuery, datasource: Datasource, onChange: OnChangeFn) => {
  const [metricMetadata, setMetricMetadata] = useState<MetricMetadata>({
    aggOptions: [],
    timeGrains: [],
    dimensions: [],
    isLoading: false,
    supportedAggTypes: [],
    primaryAggType: undefined,
  });

  const { resource, metricNamespace, metricName, aggregation, timeGrain } = query.azureMonitor ?? {};

  // Fetch new metric metadata when the fields change
  useEffect(() => {
    if (!(resource && metricNamespace && metricName)) {
      return;
    }

    datasource.getMetricMetadata(resource, metricNamespace, metricName).then((metadata) => {
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
  }, [datasource, resource, metricNamespace, metricName]);

  // Update the query state in response to the meta data changing
  useEffect(() => {
    const aggregationIsValid = aggregation && metricMetadata.supportedAggTypes.includes(aggregation);

    const newAggregation = aggregationIsValid ? aggregation : metricMetadata.primaryAggType;
    const newTimeGrain = timeGrain || 'auto';

    if (newAggregation !== aggregation || newTimeGrain !== timeGrain) {
      onChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          aggregation: newAggregation,
          timeGrain: newTimeGrain,
        },
      });
    }
  }, [onChange, metricMetadata, aggregation, timeGrain, query]);

  return metricMetadata;
};

function isInvalidOption(value: string | undefined, options: AzureMonitorOption[], templateVariables: string[]) {
  return value && !templateVariables.includes(value) && !hasOption(options, value);
}
