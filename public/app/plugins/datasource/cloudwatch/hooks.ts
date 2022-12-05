import { useEffect, useState } from 'react';
import { useAsyncFn, useDeepCompareEffect } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CloudWatchAPI } from './api';
import { CloudWatchDatasource } from './datasource';
import { GetDimensionKeysRequest, GetMetricsRequest } from './types';
import { appendTemplateVariables } from './utils/utils';

export interface FieldDataState<T> {
  options: Array<SelectableValue<T>>;
  invalid: boolean;
  isLoading: boolean;
  isClearable: boolean;
}

// type FieldDataState = Pick<SelectCommonProps<string>, 'isLoading'>;

export const useRegions = (datasource: CloudWatchDatasource): [Array<SelectableValue<string>>, boolean] => {
  const [regionsIsLoading, setRegionsIsLoading] = useState<boolean>(false);
  const [regions, setRegions] = useState<Array<SelectableValue<string>>>([{ label: 'default', value: 'default' }]);

  useEffect(() => {
    setRegionsIsLoading(true);

    const variableOptionGroup = {
      label: 'Template Variables',
      options: datasource.getVariables().map(toOption),
    };

    datasource.api
      .getRegions()
      .then((regions: Array<SelectableValue<string>>) => setRegions([...regions, variableOptionGroup]))
      .finally(() => setRegionsIsLoading(false));
  }, [datasource]);

  return [regions, regionsIsLoading];
};

export const useNamespaces = (datasource: CloudWatchDatasource, currentNamespace?: string): FieldDataState<string> => {
  const [namespaces, setNamespaces] = useState<Array<SelectableValue<string>>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    datasource.api
      .getNamespaces()
      .then((namespaces) => {
        setNamespaces(appendTemplateVariables(datasource, namespaces));
      })
      .finally(() => setIsLoading(false));
  }, [datasource]);

  const invalid = !isLoading && !namespaces.some((n) => n.value === currentNamespace);
  return {
    isLoading,
    options: namespaces,
    invalid,
    isClearable: invalid,
  };
};

export const useMetrics = (
  datasource: CloudWatchDatasource,
  { region, namespace, accountId }: GetMetricsRequest,
  currentMetricName?: string
): FieldDataState<string> => {
  const [metrics, setMetrics] = useState<Array<SelectableValue<string>>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // need to ensure dependency array below recieves the interpolated value so that the effect is triggered when a variable is changed
  if (region) {
    region = datasource.templateSrv.replace(region, {});
  }
  if (namespace) {
    namespace = datasource.templateSrv.replace(namespace, {});
  }

  if (accountId) {
    accountId = datasource.templateSrv.replace(accountId, {});
  }
  useEffect(() => {
    setIsLoading(true);
    datasource.api
      .getMetrics({ namespace, region, accountId })
      .then((result: Array<SelectableValue<string>>) => {
        setMetrics(appendTemplateVariables(datasource, result));
      })
      .finally(() => setIsLoading(false));
  }, [datasource, region, namespace, accountId]);

  const invalid = !isLoading && !metrics.some((metric) => metric.value === currentMetricName);
  return {
    isLoading,
    options: metrics,
    invalid,
    isClearable: invalid,
  };
};

export const useDimensionKeys = (
  datasource: CloudWatchDatasource,
  { region, namespace, metricName, dimensionFilters, accountId }: GetDimensionKeysRequest
) => {
  const [dimensionKeys, setDimensionKeys] = useState<Array<SelectableValue<string>>>([]);

  // need to ensure dependency array below revieves the interpolated value so that the effect is triggered when a variable is changed
  if (region) {
    region = datasource.templateSrv.replace(region, {});
  }
  if (namespace) {
    namespace = datasource.templateSrv.replace(namespace, {});
  }

  if (metricName) {
    metricName = datasource.templateSrv.replace(metricName, {});
  }

  if (accountId) {
    accountId = datasource.templateSrv.replace(accountId, {});
  }

  if (dimensionFilters) {
    dimensionFilters = datasource.api.convertDimensionFormat(dimensionFilters, {});
  }

  // doing deep comparison to avoid making new api calls to list metrics unless dimension filter object props changes
  useDeepCompareEffect(() => {
    datasource.api
      .getDimensionKeys({ namespace, region, metricName, accountId, dimensionFilters })
      .then((result: Array<SelectableValue<string>>) => {
        setDimensionKeys(appendTemplateVariables(datasource, result));
      });
  }, [datasource, namespace, region, metricName, accountId, dimensionFilters]);

  return dimensionKeys;
};

export const useDimensionKeys2 = (
  datasource: CloudWatchDatasource,
  { region, namespace, metricName, dimensionFilters, accountId }: GetDimensionKeysRequest,
  currentDimensionKey?: string
): FieldDataState<string> => {
  const [dimensionKeys, setDimensionKeys] = useState<Array<SelectableValue<string>>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // need to ensure dependency array below revieves the interpolated value so that the effect is triggered when a variable is changed
  if (region) {
    region = datasource.templateSrv.replace(region, {});
  }
  if (namespace) {
    namespace = datasource.templateSrv.replace(namespace, {});
  }

  if (metricName) {
    metricName = datasource.templateSrv.replace(metricName, {});
  }

  if (accountId) {
    accountId = datasource.templateSrv.replace(accountId, {});
  }

  if (dimensionFilters) {
    dimensionFilters = datasource.api.convertDimensionFormat(dimensionFilters, {});
  }

  // doing deep comparison to avoid making new api calls to list metrics unless dimension filter object props changes
  useDeepCompareEffect(() => {
    setIsLoading(true);
    datasource.api
      .getDimensionKeys({ namespace, region, metricName, accountId, dimensionFilters })
      .then((result: Array<SelectableValue<string>>) => {
        console.log(useDimensionKeys2);
        setDimensionKeys(appendTemplateVariables(datasource, result));
      })
      .finally(() => setIsLoading(false));
  }, [datasource, namespace, region, metricName, accountId, dimensionFilters]);

  const invalid = !isLoading && !dimensionKeys.some((dk) => dk.value === currentDimensionKey);
  return {
    isLoading,
    options: dimensionKeys,
    invalid,
    isClearable: invalid,
  };
};

export const useIsMonitoringAccount = (api: CloudWatchAPI, region: string) => {
  const [isMonitoringAccount, setIsMonitoringAccount] = useState(false);
  // we call this before the use effect to ensure dependency array below
  // receives the interpolated value so that the effect is triggered when a variable is changed
  if (region) {
    region = api.templateSrv.replace(region, {});
  }
  useEffect(() => {
    if (config.featureToggles.cloudWatchCrossAccountQuerying) {
      api.isMonitoringAccount(region).then((result) => setIsMonitoringAccount(result));
    }
  }, [region, api]);

  return isMonitoringAccount;
};

export const useAccountOptions = (
  api: Pick<CloudWatchAPI, 'getAccounts' | 'templateSrv' | 'getVariables'>,
  region: string
) => {
  // we call this before the use effect to ensure dependency array below
  // receives the interpolated value so that the effect is triggered when a variable is changed
  if (region) {
    region = api.templateSrv.replace(region, {});
  }

  const fetchAccountOptions = async () => {
    if (!config.featureToggles.cloudWatchCrossAccountQuerying) {
      return Promise.resolve([]);
    }
    const accounts = await api.getAccounts({ region });
    if (accounts.length === 0) {
      return [];
    }

    const options: Array<SelectableValue<string>> = accounts.map((a) => ({
      label: a.label,
      value: a.id,
      description: a.id,
    }));

    const variableOptions = api.getVariables().map(toOption);

    const variableOptionGroup: SelectableValue<string> = {
      label: 'Template Variables',
      options: variableOptions,
    };

    return [...options, variableOptionGroup];
  };

  const [state, doFetch] = useAsyncFn(fetchAccountOptions, [api, region]);

  useEffect(() => {
    doFetch();
  }, [api, region, doFetch]);

  return state;
};
