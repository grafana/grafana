import { useMemo } from 'react';

import { useQuery } from '../components/QueryEditor/ElasticsearchQueryContext';
import { MetricAggregation, BucketAggregation } from '../types';

const toId = <T extends { id: unknown }>(e: T): T['id'] => e.id;

const toInt = (idString: string) => parseInt(idString, 10);

export const useNextId = (): MetricAggregation['id'] | BucketAggregation['id'] => {
  const { metrics, bucketAggs } = useQuery();

  return useMemo(
    () =>
      (Math.max(...[...(metrics?.map(toId) || ['0']), ...(bucketAggs?.map(toId) || ['0'])].map(toInt)) + 1).toString(),
    [metrics, bucketAggs]
  );
};
