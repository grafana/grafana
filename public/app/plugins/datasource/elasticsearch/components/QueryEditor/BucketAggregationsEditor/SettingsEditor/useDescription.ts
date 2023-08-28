import { BucketAggregation } from '../../../../types';
import { describeMetric, convertOrderByToMetricId } from '../../../../utils';
import { useQuery } from '../../ElasticsearchQueryContext';
import { bucketAggregationConfig, orderByOptions, orderOptions } from '../utils';

const hasValue = (value: string) => (object: { value?: string }) => object.value === value;

// FIXME: We should apply the same defaults we have in bucketAggregationsConfig here instead of "custom" values
// as they might get out of sync.
// The reason we need them is that even though after the refactoring each setting is created with its default value,
// queries created with the old version might not have them.
export const useDescription = (bucketAgg: BucketAggregation): string => {
  const { metrics } = useQuery();

  switch (bucketAgg.type) {
    case 'terms': {
      const order = bucketAgg.settings?.order || 'desc';
      const size = bucketAgg.settings?.size || '10';
      const minDocCount = parseInt(bucketAgg.settings?.min_doc_count || '0', 10);
      const orderBy = bucketAgg.settings?.orderBy || '_term';
      let description = '';

      if (size !== '0') {
        const orderLabel = orderOptions.find(hasValue(order))?.label!;
        description = `${orderLabel} ${size}, `;
      }

      if (minDocCount > 0) {
        description += `Min Doc Count: ${minDocCount}, `;
      }

      description += 'Order by: ';
      const orderByOption = orderByOptions.find(hasValue(orderBy));
      if (orderByOption) {
        description += orderByOption.label;
      } else {
        const metric = metrics?.find((m) => m.id === convertOrderByToMetricId(orderBy));
        if (metric) {
          description += describeMetric(metric);
        } else {
          description += 'metric not found';
        }
      }

      if (size === '0') {
        description += ` (${order})`;
      }
      return description;
    }

    case 'histogram': {
      const interval = bucketAgg.settings?.interval || '1000';
      const minDocCount = parseInt(bucketAgg.settings?.min_doc_count || '1', 10);

      return `Interval: ${interval}${minDocCount > 0 ? `, Min Doc Count: ${minDocCount}` : ''}`;
    }

    case 'filters': {
      const filters = bucketAgg.settings?.filters || bucketAggregationConfig['filters'].defaultSettings?.filters;
      return `Filter Queries (${filters!.length})`;
    }

    case 'geohash_grid': {
      const precision = Math.max(Math.min(parseInt(bucketAgg.settings?.precision || '5', 10), 12), 1);
      return `Precision: ${precision}`;
    }

    case 'date_histogram': {
      const interval = bucketAgg.settings?.interval || 'auto';
      const minDocCount = parseInt(bucketAgg.settings?.min_doc_count || '0', 10);
      const trimEdges = parseInt(bucketAgg.settings?.trimEdges || '0', 10);

      let description = `Interval: ${interval}`;

      if (minDocCount > 0) {
        description += `, Min Doc Count: ${minDocCount}`;
      }

      if (trimEdges > 0) {
        description += `, Trim edges: ${trimEdges}`;
      }

      return description;
    }

    default:
      return 'Settings';
  }
};
