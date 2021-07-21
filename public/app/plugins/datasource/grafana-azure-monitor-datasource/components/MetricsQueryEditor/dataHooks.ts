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

type SetErrorFn = (source: string, error: AzureMonitorErrorish | undefined) => void;
type OnChangeFn = (newQuery: AzureMonitorQuery) => void;

type DataHook = (
  query: AzureMonitorQuery,
  datasource: Datasource,
  onChange: OnChangeFn,
  setError: SetErrorFn
) => AzureMonitorOption[];

function useAsyncState<T>(asyncFn: () => Promise<T>, setError: Function, dependencies: unknown[]) {
  const [errorSource] = useState(() => Math.random());
  const [value, setValue] = useState<T>();

  const finalValue = useMemo(() => value ?? [], [value]);

  useEffect(() => {
    asyncFn()
      .then((results) => {
        setValue(results);
        setError(errorSource, undefined);
      })
      .catch((err) => setError(errorSource, err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return finalValue;
}

const MAX_COMPONENT_LENGTH = 19;
function log(component: string, msg: string, ...rest: any[]) {
  const space = new Array(MAX_COMPONENT_LENGTH - component.length).fill(' ').join('');
  console.log(`%c[${component}]%c${space} ${msg}`, 'color: #2ecc71; font-weight: bold', 'color: #2ecc71;', ...rest);
}

export const useSubscriptions: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const defaultSubscription = datasource.azureMonitorDatasource.defaultSubscriptionId;

  return useAsyncState(
    async () => {
      log('useSubscriptions', 'requesting data');
      const results = await datasource.azureMonitorDatasource.getSubscriptions();
      const options = results.map((v) => ({ label: v.text, value: v.value, description: v.value }));

      if (!subscription && defaultSubscription && hasOption(options, defaultSubscription)) {
        log('useSubscriptions', 'setting default subscription');
        onChange(setSubscriptionID(query, defaultSubscription));
      } else if ((!subscription && options.length) || options.length === 1) {
        log('useSubscriptions', 'setting first subscription');
        onChange(setSubscriptionID(query, options[0].value));
      }

      return options;
    },
    setError,
    []
  );
};

export const useResourceGroups: DataHook = (query, datasource, onChange, setError) => {
  const { subscription } = query;
  const { resourceGroup } = query.azureMonitor ?? {};

  return useAsyncState(
    async () => {
      if (!subscription) {
        log('useResourceGroups', 'not requesting', {
          subscription,
        });
        return;
      }

      log('useResourceGroups', 'requesting data', { subscription });
      const results = await datasource.getResourceGroups(subscription);
      const options = results.map(toOption);

      if (resourceGroup && !hasOption(options, resourceGroup)) {
        log('useResourceGroups', 'clearing resourceGroup because its not in the new options');
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
        log('useResourceTypes', 'not requesting', {
          subscription,
          resourceGroup,
        });
        return;
      }

      log('useResourceTypes', 'requesting data', { subscription, resourceGroup });
      const results = await datasource.getMetricDefinitions(subscription, resourceGroup);
      const options = results.map(toOption);

      if (metricDefinition && !hasOption(options, metricDefinition)) {
        log('useResourceTypes', 'clearing metricDefinition because its not in the new options');
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
        log('useResourceNames', 'not requesting', {
          subscription,
          resourceGroup,
          metricDefinition,
        });
        return;
      }

      log('useResourceNames', 'requesting data', { subscription, resourceGroup, metricDefinition });
      const results = await datasource.getResourceNames(subscription, resourceGroup, metricDefinition);
      const options = results.map(toOption);

      if (resourceName && !hasOption(options, resourceName)) {
        log('useResourceNames', 'clearing resourceName because its not in the new options');
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
        log('useMetricNamespaces', 'not requesting', {
          subscription,
          resourceGroup,
          metricDefinition,
          resourceName,
        });
        return;
      }

      log('useMetricNamespaces', 'requesting data', { subscription, resourceGroup, metricDefinition, resourceName });
      const results = await datasource.getMetricNamespaces(subscription, resourceGroup, metricDefinition, resourceName);
      const options = results.map(toOption);

      // Do some cleanup of the query state if need be
      if ((!metricNamespace && options.length) || options.length === 1) {
        log(
          'useMetricNamespaces',
          'setting first default metricNamespace because metricNamespace is not defined yet, or only one namespace came back'
        );
        onChange(setMetricNamespace(query, options[0].value));
      } else if (metricNamespace && !hasOption(options, metricNamespace)) {
        log('useMetricNamespaces', 'setting first default metricNamespace because metricNamespace is not in options');
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
        log('useMetricNames', 'not requesting', {
          subscription,
          resourceGroup,
          metricDefinition,
          resourceName,
          metricNamespace,
        });
        return;
      }

      log('useMetricNames', 'requesting data', {
        subscription,
        resourceGroup,
        metricDefinition,
        resourceName,
        metricNamespace,
      });
      const results = await datasource.getMetricNames(
        subscription,
        resourceGroup,
        metricDefinition,
        resourceName,
        metricNamespace
      );

      const options = results.map(toOption);

      if (metricName && !hasOption(options, metricName)) {
        log('useMetricNames', 'clearing metricName because its not in the new options');
        onChange(setMetricName(query, undefined));
      }

      return options;
    },
    setError,
    [subscription, resourceGroup, metricDefinition, resourceName, metricNamespace]
  );
};
