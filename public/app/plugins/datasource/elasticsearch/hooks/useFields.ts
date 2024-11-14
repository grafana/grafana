import { lastValueFrom } from 'rxjs';

import { MetricFindValue, SelectableValue } from '@grafana/data';

import { isBucketAggregationType } from '../components/QueryEditor/BucketAggregationsEditor/aggregations';
import { useDatasource, useRange } from '../components/QueryEditor/ElasticsearchQueryContext';
import { isMetricAggregationType } from '../components/QueryEditor/MetricAggregationsEditor/aggregations';
import { MetricAggregationType, BucketAggregationType } from '../types';

type AggregationType = BucketAggregationType | MetricAggregationType;

const getFilter = (type: AggregationType) => {
  if (isMetricAggregationType(type)) {
    switch (type) {
      case 'cardinality':
        return [];
      case 'top_metrics':
        // top_metrics was introduced in 7.7 where `metrics` only supported number:
        // https://www.elastic.co/guide/en/elasticsearch/reference/7.7/search-aggregations-metrics-top-metrics.html#_metrics
        // TODO: starting from 7.11 it supports ips and keywords as well:
        // https://www.elastic.co/guide/en/elasticsearch/reference/7.11/search-aggregations-metrics-top-metrics.html#_metrics
        return ['number'];
      default:
        return ['number'];
    }
  }

  if (isBucketAggregationType(type)) {
    switch (type) {
      case 'date_histogram':
        return ['date'];
      case 'geohash_grid':
        return ['geo_point'];
      case 'histogram':
        return ['number'];
      default:
        return [];
    }
  }

  return [];
};

const toSelectableValue = ({ text }: MetricFindValue): SelectableValue<string> => ({
  label: text,
  value: text,
});

/**
 * Returns a function to query the configured datasource for autocomplete values for the specified aggregation type or data types.
 * Each aggregation can be run on different types, for example avg only operates on numeric fields, geohash_grid only on geo_point fields.
 * If an aggregation type is provided, the promise will resolve with all fields suitable to be used as a field for the given aggregation.
 * If an array of types is providem the promise will resolve with all the fields matching the provided types.
 * @param aggregationType the type of aggregation to get fields for
 */
export const useFields = (type: AggregationType | string[]) => {
  const datasource = useDatasource();
  const range = useRange();
  const filter = Array.isArray(type) ? type : getFilter(type);
  let rawFields: MetricFindValue[];

  return async (q?: string) => {
    // _mapping doesn't support filtering, we avoid sending a request everytime q changes
    if (!rawFields) {
      rawFields = await lastValueFrom(datasource.getFields(filter, range));
    }

    return rawFields.filter(({ text }) => q === undefined || text.includes(q)).map(toSelectableValue);
  };
};
