import { MetricFindValue, SelectableValue } from '@grafana/data';
import { BucketAggregationType } from '../components/QueryEditor/BucketAggregationsEditor/aggregations';
import { useDatasource, useRange } from '../components/QueryEditor/ElasticsearchQueryContext';
import {
  isMetricAggregationType,
  MetricAggregationType,
} from '../components/QueryEditor/MetricAggregationsEditor/aggregations';

type AggregationType = BucketAggregationType | MetricAggregationType;

const getFilter = (aggregationType: AggregationType) => {
  // For all metric types we want only numbers, except for cardinality
  // TODO: To have a more configuration-driven editor, it would be nice to move this logic in
  // metricAggregationConfig and bucketAggregationConfig so that each aggregation type can specify on
  // which kind of data it operates.
  if (isMetricAggregationType(aggregationType)) {
    if (aggregationType !== 'cardinality') {
      return 'number';
    }

    return void 0;
  }

  switch (aggregationType) {
    case 'date_histogram':
      return 'date';
    case 'geohash_grid':
      return 'geo_point';
    default:
      return void 0;
  }
};

const toSelectableValue = ({ text }: MetricFindValue): SelectableValue<string> => ({
  label: text,
  value: text,
});

/**
 * Returns a function to query the configured datasource for autocomplete values for the specified aggregation type.
 * Each aggregation can be run on different types, for example avg only operates on numeric fields, geohash_grid only on geo_point fields.
 * @param aggregationType the type of aggregation to get fields for
 */
export const useFields = (aggregationType: AggregationType) => {
  const datasource = useDatasource();
  const range = useRange();
  const filter = getFilter(aggregationType);

  return async () => {
    const rawFields = await datasource.getFields(filter, range).toPromise();
    return rawFields.map(toSelectableValue);
  };
};
