import { describeMetric } from '../../../utils';
import { useQuery } from '../../ElasticsearchQueryContext';
import { BucketAggregation } from '../state/types';
import { orderByOptions, orderOptions } from '../utils';

const hasValue = (value: string) => (object: { value: string }) => object.value === value;

// FIXME: All the defaults and validations down here should be defined somewhere else
// as they are also the defaults that are gonna be applied to the query.
// In the previous version, the same methos was taking care of describing the settings and setting defaults.
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
        description += `Min Doc Count: ${minDocCount}`;
      }

      description += 'Order by: ';
      const orderByOption = orderByOptions.find(hasValue(orderBy));
      if (orderByOption) {
        description += orderByOption.label;
      } else {
        const metric = metrics?.find(m => m.id === orderBy);
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
      const interval = bucketAgg.settings?.interval || 1000;
      const minDocCount = bucketAgg.settings?.min_doc_count || 1;

      return `Interval: ${interval}${minDocCount > 0 ? `, Min Doc Count: ${minDocCount}` : ''}`;
    }
    case 'filters': {
      // TODO: Check if this was intentional, as the previous version has some unused logic.
      const filters = bucketAgg.settings?.filters || [{ query: '*', label: '' }];
      return `Filter Queries (${filters.length})`;
    }

    case 'geohash_grid': {
      const precision = Math.max(Math.min(parseInt(bucketAgg.settings?.precision || '5', 10), 12), 1);
      return `Precision: ${precision}`;
    }

    case 'date_histogram': {
      const interval = bucketAgg.settings?.interval || 1000;
      const minDocCount = bucketAgg.settings?.min_doc_count || 1;
      const trimEdges = bucketAgg.settings?.trimEdges || 0;

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
