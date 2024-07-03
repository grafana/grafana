// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/query_hints.ts
import { size } from 'lodash';

import { QueryFix, QueryHint } from '@grafana/data';

import { PrometheusDatasource } from './datasource';
import { PromMetricsMetadata } from './types';

/**
 * Number of time series results needed before starting to suggest sum aggregation hints
 */
export const SUM_HINT_THRESHOLD_COUNT = 20;

export function getQueryHints(query: string, series?: unknown[], datasource?: PrometheusDatasource): QueryHint[] {
  const hints = [];

  const metricsMetadata = datasource?.languageProvider?.metricsMetadata;

  // ..._bucket metric needs a histogram_quantile()
  // this regex also prevents hints from being shown when a query already has a function
  const oldHistogramMetric = query.trim().match(/^\w+_bucket$|^\w+_bucket{.*}$/);
  if (oldHistogramMetric) {
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
      },
    });
  } else if (metricsMetadata && simpleQueryCheck(query)) {
    // having migrated to native histograms
    // there will be no more old histograms (no buckets)
    // and we can identify a native histogram by the following
    // type === 'histogram'
    // metric name does not include '_bucket'
    const queryTokens = getQueryTokens(query);

    // Determine whether any of the query identifier tokens refers to a native histogram metric
    const { nameMetric } = checkMetricType(queryTokens, 'histogram', metricsMetadata, false);

    const nativeHistogramNameMetric = nameMetric;

    if (nativeHistogramNameMetric) {
      // add hints:
      // histogram_avg, histogram_count, histogram_sum, histogram_fraction, histogram_stddev, histogram_stdvar
      const label = 'Selected metric is a native histogram.';
      hints.push(
        {
          type: 'HISTOGRAM_AVG',
          label,
          fix: {
            label: 'Consider calculating the arithmetic average of observed values by adding histogram_avg().',
            action: {
              type: 'ADD_HISTOGRAM_AVG',
              query,
            },
          },
        },
        {
          type: 'HISTOGRAM_COUNT',
          label,
          fix: {
            label: 'Consider calculating the count of observations by adding histogram_count().',
            action: {
              type: 'ADD_HISTOGRAM_COUNT',
              query,
            },
          },
        },
        {
          type: 'HISTOGRAM_SUM',
          label,
          fix: {
            label: 'Consider calculating the sum of observations by adding histogram_sum().',
            action: {
              type: 'ADD_HISTOGRAM_SUM',
              query,
            },
          },
        },
        {
          type: 'HISTOGRAM_FRACTION',
          label,
          fix: {
            label:
              'Consider calculating the estimated fraction of observations between the provided lower and upper values by adding histogram_fraction().',
            action: {
              type: 'ADD_HISTOGRAM_FRACTION',
              query,
            },
          },
        },
        {
          type: 'HISTOGRAM_STDDEV',
          label,
          fix: {
            label:
              'Consider calculating the estimated standard deviation of observations by adding histogram_stddev().',
            action: {
              type: 'ADD_HISTOGRAM_STDDEV',
              query,
            },
          },
        },
        {
          type: 'HISTOGRAM_STDVAR',
          label,
          fix: {
            label: 'Consider calculating the estimated standard variance of observations by adding histogram_stdvar().',
            action: {
              type: 'ADD_HISTOGRAM_STDVAR',
              query,
            },
          },
        }
      );
    }
  }

  // Check for need of rate()
  if (query.indexOf('rate(') === -1 && query.indexOf('increase(') === -1) {
    // Use metric metadata for exact types
    const nameMatch = query.match(/\b((?<!:)\w+_(total|sum|count)(?!:))\b/);
    let counterNameMetric = nameMatch ? nameMatch[1] : '';
    let certain = false;

    if (metricsMetadata) {
      // Tokenize the query into its identifiers (see https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels)
      const queryTokens = getQueryTokens(query);
      // Determine whether any of the query identifier tokens refers to a counter metric
      const metricTypeChecked = checkMetricType(queryTokens, 'counter', metricsMetadata, certain);

      counterNameMetric = metricTypeChecked.nameMetric;
      certain = metricTypeChecked.certain;
    }

    if (counterNameMetric) {
      // FixableQuery consists of metric name and optionally label-value pairs. We are not offering fix for complex queries yet.
      const fixableQuery = simpleQueryCheck(query);
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
        },
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
        },
      });
    }
  }

  return hints;
}

export function getInitHints(datasource: PrometheusDatasource): QueryHint[] {
  const hints = [];

  // Hint for big disabled lookups
  if (datasource.lookupsDisabled) {
    hints.push({
      label: `Labels and metrics lookup was disabled in data source settings.`,
      type: 'INFO',
    });
  }

  return hints;
}

function getQueryTokens(query: string) {
  return (
    Array.from(query.matchAll(/\$?[a-zA-Z_:][a-zA-Z0-9_:]*/g))
      .map(([match]) => match)
      // Exclude variable identifiers
      .filter((token) => !token.startsWith('$'))
      // Split composite keys to match the tokens returned by the language provider
      .flatMap((token) => token.split(':'))
  );
}

function checkMetricType(
  queryTokens: string[],
  metricType: string,
  metricsMetadata: PromMetricsMetadata,
  certain: boolean
) {
  // update certain to change language for counters
  const nameMetric =
    queryTokens.find((metricName) => {
      // Only considering first type information, could be non-deterministic
      const metadata = metricsMetadata[metricName];
      if (metadata && metadata.type.toLowerCase() === metricType) {
        certain = true;
        return true;
      } else {
        return false;
      }
    }) ?? '';

  return { nameMetric, certain };
}

/**
 * This regex check looks for only metric name and label filters.
 * This prevents hints from being shown when a query already has a functions or is complex.
 * */
function simpleQueryCheck(query: string) {
  return query.trim().match(/^\w+$|^\w+{.*}$/);
}
