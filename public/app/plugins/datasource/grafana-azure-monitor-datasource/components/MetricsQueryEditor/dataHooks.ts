import { useState, useEffect, useMemo } from 'react';
import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import { hasOption, toOption } from '../../utils/common';
import {
  setMetricName,
  setMetricNamespace,
  setResourceGroup,
  setResourceName,
  setResourceType,
  setSubscriptionID,
} from './setQueryValue';

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

type DataHook = (
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

export const useSubscriptions: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const defaultSubscription = datasource.azureMonitorDatasource.defaultSubscriptionId;

  const subscriptionOptions = useAsyncState(
    async () => {
      const results = await datasource.azureMonitorDatasource.getSubscriptions();
      return results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
    },
    setError,
    []
  );

  useEffect(() => {
    // Return early if subscriptions havent loaded, or if the query already has a subscription
    if (!subscriptionOptions.length || (subscription && hasOption(subscriptionOptions, subscription))) {
      return;
    }

    const defaultSub = defaultSubscription || subscriptionOptions[0].value;

    if (!subscription && defaultSub && hasOption(subscriptionOptions, defaultSub)) {
      onChange(setSubscriptionID(query, defaultSub));
    }
  }, [subscriptionOptions, query, subscription, defaultSubscription, onChange]);

  return subscriptionOptions;
};

export const useResourceGroups: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { resourceGroup } = query.azureMonitor ?? {};

  return useAsyncState(
    async () => {
      if (!subscription) {
        return;
      }

      const results = await datasource.getResourceGroups(subscription);
      const options = results.map(toOption);

      if (resourceGroup && !hasOption(options, resourceGroup)) {
        onChange(setResourceGroup(query, undefined));
      }

      return options;
    },
    setError,
    [subscription]
  );
};

export const useResourceTypes: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { resourceGroup, metricDefinition } = query.azureMonitor ?? {};

  return useAsyncState(
    async () => {
      if (!(subscription && resourceGroup)) {
        return;
      }

      const results = await datasource.getMetricDefinitions(subscription, resourceGroup);
      const options = results.map(toOption);

      if (metricDefinition && !hasOption(options, metricDefinition)) {
        onChange(setResourceType(query, undefined));
      }

      return options;
    },
    setError,
    [subscription, resourceGroup]
  );
};

export const useResourceNames: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { resourceGroup, metricDefinition, resourceName } = query.azureMonitor ?? {};

  return useAsyncState(
    async () => {
      if (!(subscription && resourceGroup && metricDefinition)) {
        return;
      }

      const results = await datasource.getResourceNames(subscription, resourceGroup, metricDefinition);
      const options = results.map(toOption);

      if (resourceName && !hasOption(options, resourceName)) {
        onChange(setResourceName(query, undefined));
      }

      return options;
    },
    setError,
    [subscription, resourceGroup, metricDefinition]
  );
};

export const useMetricNamespaces: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { resourceGroup, metricDefinition, resourceName, metricNamespace } = query.azureMonitor ?? {};

  const metricNamespaces = useAsyncState(
    async () => {
      if (!(subscription && resourceGroup && metricDefinition && resourceName)) {
        return;
      }

      const results = await datasource.getMetricNamespaces(subscription, resourceGroup, metricDefinition, resourceName);
      const options = results.map(toOption);

      // Do some cleanup of the query state if need be
      if ((!metricNamespace && options.length) || options.length === 1) {
        onChange(setMetricNamespace(query, options[0].value));
      } else if (options[0] && metricNamespace && !hasOption(options, metricNamespace)) {
        onChange(setMetricNamespace(query, options[0].value));
      }

      return options;
    },
    setError,
    [subscription, resourceGroup, metricDefinition, resourceName]
  );

  return metricNamespaces;
};

export const useMetricNames: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { resourceGroup, metricDefinition, resourceName, metricNamespace, metricName } = query.azureMonitor ?? {};

  return useAsyncState(
    async () => {
      if (!(subscription && resourceGroup && metricDefinition && resourceName && metricNamespace)) {
        return;
      }

      const results = await datasource.getMetricNames(
        subscription,
        resourceGroup,
        metricDefinition,
        resourceName,
        metricNamespace
      );

      const options = results.map(toOption);

      if (metricName && !hasOption(options, metricName)) {
        onChange(setMetricName(query, undefined));
      }

      return options;
    },
    setError,
    [subscription, resourceGroup, metricDefinition, resourceName, metricNamespace]
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

  const { subscription } = query;
  const { resourceGroup, metricDefinition, resourceName, metricNamespace, metricName, aggregation, timeGrain } =
    query.azureMonitor ?? {};

  // Fetch new metric metadata when the fields change
  useEffect(() => {
    if (!(subscription && resourceGroup && metricDefinition && resourceName && metricNamespace && metricName)) {
      return;
    }

    datasource
      .getMetricMetadata(subscription, resourceGroup, metricDefinition, resourceName, metricNamespace, metricName)
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
  }, [datasource, subscription, resourceGroup, metricDefinition, resourceName, metricNamespace, metricName]);

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
