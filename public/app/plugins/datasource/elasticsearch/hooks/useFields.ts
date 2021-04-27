import { MetricFindValue, SelectableValue } from '@grafana/data';
import {
  BucketAggregationType,
  isBucketAggregationType,
} from '../components/QueryEditor/BucketAggregationsEditor/aggregations';
import { useDatasource, useRange } from '../components/QueryEditor/ElasticsearchQueryContext';
import {
  isMetricAggregationType,
  MetricAggregationType,
} from '../components/QueryEditor/MetricAggregationsEditor/aggregations';

type AggregationType = BucketAggregationType | MetricAggregationType;

const getFilter = (type: AggregationType | string[]) => {
  // TODO: To have a more configuration-driven editor, it would be nice to move this logic in
  // metricAggregationConfig and bucketAggregationConfig so that each aggregation type can specify on
  // which kind of data it operates.
  if (Array.isArray(type)) {
    return type;
  }

  if (isMetricAggregationType(type)) {
    switch (type) {
      case 'cardinality':
        return void 0;
      case 'top_metrics':
        return ['number', 'ip'];
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
      default:
        return void 0;
    }
  }

  return void 0;
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
  const filter = getFilter(type);

  return async () => {
    const rawFields = await datasource.getFields(filter, range).toPromise();
    return rawFields.map(toSelectableValue);
  };
};
