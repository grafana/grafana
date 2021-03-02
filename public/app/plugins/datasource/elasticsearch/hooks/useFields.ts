import { MetricFindValue, SelectableValue } from '@grafana/data';
import { BucketAggregationType } from '../components/QueryEditor/BucketAggregationsEditor/aggregations';
import { useDatasource, useRange } from '../components/QueryEditor/ElasticsearchQueryContext';
import {
  isMetricAggregationType,
  MetricAggregationType,
} from '../components/QueryEditor/MetricAggregationsEditor/aggregations';

const toSelectableValue = ({ value, text }: MetricFindValue): SelectableValue<string> => ({
  label: text,
  value: `${value || text}`,
});

const getFilter = (aggregationType: BucketAggregationType | MetricAggregationType) => {
  // For all metric types we want only numbers, except for cardinality
  if (isMetricAggregationType(aggregationType)) {
    if (aggregationType === 'cardinality') {
      return null;
    }
    return 'number';
  }

  switch (aggregationType) {
    case 'date_histogram':
      return 'date';
    case 'geohash_grid':
      return 'geo_point';
    default:
      return null;
  }
};

export const useFields = (aggregationType: BucketAggregationType | MetricAggregationType) => {
  const datasource = useDatasource();
  const range = useRange();
  const filter = getFilter(aggregationType);

  return async () => {
    const rawFields = await datasource.getFields(range, filter).toPromise();
    return rawFields.map(toSelectableValue);
  };
};
