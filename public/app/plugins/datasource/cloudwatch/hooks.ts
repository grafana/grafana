import { useEffect, useState } from 'react';
import { useDeepCompareEffect } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';

import { CloudWatchDatasource } from './datasource';
import { Dimensions } from './types';
import { appendTemplateVariables } from './utils/utils';

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

export const useNamespaces = (datasource: CloudWatchDatasource) => {
  const [namespaces, setNamespaces] = useState<Array<SelectableValue<string>>>([]);
  useEffect(() => {
    datasource.api.getNamespaces().then((namespaces) => {
      setNamespaces(appendTemplateVariables(datasource, namespaces));
    });
  }, [datasource]);

  return namespaces;
};

export const useMetrics = (datasource: CloudWatchDatasource, region: string, namespace: string | undefined) => {
  const [metrics, setMetrics] = useState<Array<SelectableValue<string>>>([]);
  useEffect(() => {
    datasource.api.getMetrics(namespace, region).then((result: Array<SelectableValue<string>>) => {
      setMetrics(appendTemplateVariables(datasource, result));
    });
  }, [datasource, region, namespace]);

  return metrics;
};

export const useDimensionKeys = (
  datasource: CloudWatchDatasource,
  region: string,
  namespace: string | undefined,
  metricName: string | undefined,
  dimensionFilter?: Dimensions
) => {
  const [dimensionKeys, setDimensionKeys] = useState<Array<SelectableValue<string>>>([]);

  // doing deep comparison to avoid making new api calls to list metrics unless dimension filter object props changes
  useDeepCompareEffect(() => {
    datasource.api
      .getDimensionKeys(namespace, region, dimensionFilter, metricName)
      .then((result: Array<SelectableValue<string>>) => {
        setDimensionKeys(appendTemplateVariables(datasource, result));
      });
  }, [datasource, region, namespace, metricName, dimensionFilter]);

  return dimensionKeys;
};
