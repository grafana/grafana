import { extendedStats } from '../../../query_def';
import { MetricAggregation } from '../aggregations';

const hasValue = (value: string) => (object: { value: string }) => object.value === value;

// FIXME: All the defaults and validations down here should be defined somewhere else
// as they are also the defaults that are gonna be applied to the query.
// In the previous version, the same methos was taking care of describing the settings and setting defaults.
export const useDescription = (metric: MetricAggregation): string => {
  switch (metric.type) {
    case 'cardinality': {
      const precisionThreshold = metric.settings?.precision_threshold || '';
      return `Precision threshold: ${precisionThreshold}`;
    }

    case 'percentiles': {
      // TODO: Elastic default is different. Which one should we keep?
      // if the following, change SettingsEditor accordingly
      const percents = metric.settings?.percents || [25, 50, 75, 95, 99];
      return `Values: ${percents}`;
    }

    case 'extended_stats': {
      // TODO: those defaults needs to go somewhere else
      // if (_.keys($scope.agg.meta).length === 0) {
      //   $scope.agg.meta.std_deviation_bounds_lower = true;
      //   $scope.agg.meta.std_deviation_bounds_upper = true;
      // }
      const selectedStats = Object.entries(metric.meta || {})
        .map(([key, value]) => value && extendedStats.find(hasValue(key))?.label)
        .filter(Boolean);

      return `Stats: ${selectedStats.length > 0 ? selectedStats.join(', ') : 'None selected'}`;
    }

    case 'raw_document':
    case 'raw_data': {
      const size = metric.settings?.size || 500;
      return `Size: ${size}`;
    }

    default:
      return 'Options';
  }
};
