import _ from 'lodash';
import { QueryHint, QueryFix } from '@grafana/data';
import { PrometheusDatasource } from './datasource';

/**
 * Number of time series results needed before starting to suggest sum aggregation hints
 */
export const SUM_HINT_THRESHOLD_COUNT = 20;

export function getQueryHints(query: string, series?: any[], datasource?: PrometheusDatasource): QueryHint[] {
  const hints = [];

  // ..._bucket metric needs a histogram_quantile()
  const histogramMetric = query.trim().match(/^\w+_bucket$/);
  if (histogramMetric) {
    const label = 'Time series has buckets, you probably wanted a histogram.';
    hints.push({
      type: 'HISTOGRAM_QUANTILE',
      label,
      fix: {
        label: 'Fix by adding histogram_quantile().',
        action: {
          type: 'ADD_HISTOGRAM_QUANTILE',
          query,
        },
      } as QueryFix,
    });
  }

  // Check for need of rate()
  if (query.indexOf('rate(') === -1 && query.indexOf('increase(') === -1) {
    // Use metric metadata for exact types
    const nameMatch = query.match(/\b(\w+_(total|sum|count))\b/);
    let counterNameMetric = nameMatch ? nameMatch[1] : '';
    const metricsMetadata = datasource?.languageProvider?.metricsMetadata ?? {};
    const metricMetadataKeys = Object.keys(metricsMetadata);
    let certain = false;

    if (metricMetadataKeys.length > 0) {
      counterNameMetric =
        metricMetadataKeys.find(metricName => {
          // Only considering first type information, could be non-deterministic
          const metadata = metricsMetadata[metricName][0];
          if (metadata.type.toLowerCase() === 'counter') {
            const metricRegex = new RegExp(`\\b${metricName}\\b`);
            if (query.match(metricRegex)) {
              certain = true;
              return true;
            }
          }
          return false;
        }) ?? '';
    }

    if (counterNameMetric) {
      const simpleMetric = query.trim().match(/^\w+$/);
      const verb = certain ? 'is' : 'looks like';
      let label = `Metric ${counterNameMetric} ${verb} a counter.`;
      let fix: QueryFix | undefined;

      if (simpleMetric) {
        fix = {
          label: 'Fix by adding rate().',
          action: {
            type: 'ADD_RATE',
            query,
          },
        };
      } else {
        label = `${label} Try applying a rate() function.`;
      }

      hints.push({
        type: 'APPLY_RATE',
        label,
        fix,
      });
    }
  }

  // Check for recording rules expansion
  if (datasource && datasource.ruleMappings) {
    const mapping = datasource.ruleMappings;
    const mappingForQuery = Object.keys(mapping).reduce((acc, ruleName) => {
      if (query.search(ruleName) > -1) {
        return {
          ...acc,
          [ruleName]: mapping[ruleName],
        };
      }
      return acc;
    }, {});
    if (_.size(mappingForQuery) > 0) {
      const label = 'Query contains recording rules.';
      hints.push({
        type: 'EXPAND_RULES',
        label,
        fix: ({
          label: 'Expand rules',
          action: {
            type: 'EXPAND_RULES',
            query,
            mapping: mappingForQuery,
          },
        } as any) as QueryFix,
      });
    }
  }

  if (series && series.length >= SUM_HINT_THRESHOLD_COUNT) {
    const simpleMetric = query.trim().match(/^\w+$/);
    if (simpleMetric) {
      hints.push({
        type: 'ADD_SUM',
        label: 'Many time series results returned.',
        fix: {
          label: 'Consider aggregating with sum().',
          action: {
            type: 'ADD_SUM',
            query: query,
            preventSubmit: true,
          },
        } as QueryFix,
      });
    }
  }

  return hints;
}
