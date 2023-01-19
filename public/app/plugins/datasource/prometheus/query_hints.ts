import { size } from 'lodash';

import { QueryHint, QueryFix } from '@grafana/data';

import { PrometheusDatasource } from './datasource';

/**
 * Number of time series results needed before starting to suggest sum aggregation hints
 */
export const SUM_HINT_THRESHOLD_COUNT = 20;

export function getQueryHints(query: string, series?: any[], datasource?: PrometheusDatasource): QueryHint[] {
  const hints = [];

  // ..._bucket metric needs a histogram_quantile()
  const histogramMetric = query.trim().match(/^\w+_bucket$|^\w+_bucket{.*}$/);
  if (histogramMetric) {
    const label = 'Selected metric has buckets.';
    hints.push({
      type: 'HISTOGRAM_QUANTILE',
      label,
      fix: {
        label: 'Consider calculating aggregated quantile by adding histogram_quantile().',
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
    const metricsMetadata = datasource?.languageProvider?.metricsMetadata;
    let certain = false;

    if (metricsMetadata) {
      // Tokenize the query into its identifiers (see https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels)
      const queryTokens = Array.from(query.matchAll(/\$?[a-zA-Z_:][a-zA-Z0-9_:]*/g))
        .map(([match]) => match)
        // Exclude variable identifiers
        .filter((token) => !token.startsWith('$'))
        // Split composite keys to match the tokens returned by the language provider
        .flatMap((token) => token.split(':'));
      // Determine whether any of the query identifier tokens refers to a counter metric
      counterNameMetric =
        queryTokens.find((metricName) => {
          // Only considering first type information, could be non-deterministic
          const metadata = metricsMetadata[metricName];
          if (metadata && metadata.type.toLowerCase() === 'counter') {
            certain = true;
            return true;
          } else {
            return false;
          }
        }) ?? '';
    }

    if (counterNameMetric) {
      // FixableQuery consists of metric name and optionally label-value pairs. We are not offering fix for complex queries yet.
      const fixableQuery = query.trim().match(/^\w+$|^\w+{.*}$/);
      const verb = certain ? 'is' : 'looks like';
      let label = `Selected metric ${verb} a counter.`;
      let fix: QueryFix | undefined;

      if (fixableQuery) {
        fix = {
          label: 'Consider calculating rate of counter by adding rate().',
          action: {
            type: 'ADD_RATE',
            query,
          },
        };
      } else {
        label = `${label} Consider calculating rate of counter by adding rate().`;
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
    if (size(mappingForQuery) > 0) {
      const label = 'Query contains recording rules.';
      hints.push({
        type: 'EXPAND_RULES',
        label,
        fix: {
          label: 'Expand rules',
          action: {
            type: 'EXPAND_RULES',
            query,
            options: mappingForQuery,
          },
        } as unknown as QueryFix,
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

export function getInitHints(datasource: PrometheusDatasource): QueryHint[] {
  const hints = [];
  // Hint if using Loki as Prometheus data source
  if (datasource.directUrl.includes('/loki') && !datasource.languageProvider.metrics.length) {
    hints.push({
      label: `Using Loki as a Prometheus data source is no longer supported. You must use the Loki data source for your Loki instance.`,
      type: 'INFO',
    });
  }

  // Hint for big disabled lookups
  if (datasource.lookupsDisabled) {
    hints.push({
      label: `Labels and metrics lookup was disabled in data source settings.`,
      type: 'INFO',
    });
  }

  return hints;
}
