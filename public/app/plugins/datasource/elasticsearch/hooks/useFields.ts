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
  if (isMetricAggregationType(aggregationType)) {
    if (aggregationType !== 'cardinality') {
      return 'number';
    }

    return null;
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

const toSelectableValue = ({ value, text }: MetricFindValue): SelectableValue<string> => ({
  label: text,
  value: `${value || text}`,
});

export const useFields = (aggregationType: AggregationType) => {
  const datasource = useDatasource();
  const range = useRange();
  const filter = getFilter(aggregationType);

  return async () => {
    const rawFields = await datasource.getFields(filter as string, range).toPromise();
    return rawFields.map(toSelectableValue);
  };
};
