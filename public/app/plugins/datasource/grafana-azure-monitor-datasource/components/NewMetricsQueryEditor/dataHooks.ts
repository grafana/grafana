import { useEffect, useState } from 'react';

import { rangeUtil } from '@grafana/data';

import Datasource from '../../datasource';
import TimegrainConverter from '../../time_grain_converter';
import { AzureMonitorOption, AzureMonitorQuery } from '../../types';
import { toOption } from '../../utils/common';
import { useAsyncState } from '../../utils/useAsyncState';
import { DataHook } from '../MetricsQueryEditor/dataHooks';
import { setMetricNamespace } from '../MetricsQueryEditor/setQueryValue';

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

export const useMetricNamespaces: DataHook = (query, datasource, onChange, setError) => {
  const { metricNamespace, resourceUri } = query.azureMonitor ?? {};

  const metricNamespaces = useAsyncState(
    async () => {
      if (!resourceUri) {
        return;
      }

      const results = await datasource.azureMonitorDatasource.getMetricNamespaces({ resourceUri });
      const options = formatOptions(results, metricNamespace);

      // Do some cleanup of the query state if need be
      if (!metricNamespace && options.length) {
        onChange(setMetricNamespace(query, options[0].value));
      }

      return options;
    },
    setError,
    [resourceUri]
  );

  return metricNamespaces;
};

export const useMetricNames: DataHook = (query, datasource, onChange, setError) => {
  const { metricNamespace, metricName, resourceUri } = query.azureMonitor ?? {};

  return useAsyncState(
    async () => {
      if (!(metricNamespace && resourceUri)) {
        return;
      }

      const results = await datasource.azureMonitorDatasource.getMetricNames({ resourceUri, metricNamespace });
      const options = formatOptions(results, metricName);

      return options;
    },
    setError,
    [resourceUri, metricNamespace]
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

  const { resourceUri, metricNamespace, metricName, aggregation, timeGrain } = query.azureMonitor ?? {};

  // Fetch new metric metadata when the fields change
  useEffect(() => {
    if (!(resourceUri && metricNamespace && metricName)) {
      setMetricMetadata(defaultMetricMetadata);
      return;
    }

    datasource.azureMonitorDatasource
      .getMetricMetadata({ resourceUri, metricNamespace, metricName })
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
  }, [datasource, resourceUri, metricNamespace, metricName]);

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
