import { useMemo } from 'react';
import { useQuery } from '../components/ElasticsearchQueryContext';
import { BucketAggregation } from '../components/BucketAggregationsEditor/aggregations';
import { MetricAggregation } from '../components/MetricAggregationsEditor/aggregations';

const toId = <T extends { id: unknown }>(e: T): T['id'] => e.id;

const toInt = (idString: string) => parseInt(idString, 10);

export const useNextId = (): MetricAggregation['id'] | BucketAggregation['id'] => {
  const { metrics, bucketAggs } = useQuery();

  return useMemo(
    () => (Math.max(...metrics?.map(toId).map(toInt), ...bucketAggs?.map(toId).map(toInt)) + 1).toString(),
    [metrics, bucketAggs]
  );
};
