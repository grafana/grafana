// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/query_hints.ts
import { size } from 'lodash';

import { QueryFix, QueryHint } from '@grafana/data';

import { PrometheusDatasource } from './datasource';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { QueryBuilderLabelFilter } from './querybuilder/shared/types';
import { PromVisualQuery } from './querybuilder/types';
import { PromMetricsMetadata, RecordingRuleIdentifier, RuleQueryMapping } from './types';

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
      // histogram_quantile, histogram_avg, histogram_count
      const label = 'Selected metric is a native histogram.';
      hints.push(
        {
          type: 'HISTOGRAM_QUANTILE',
          label,
          fix: {
            label: 'Consider calculating aggregated quantile by adding histogram_quantile().',
            action: {
              type: 'ADD_HISTOGRAM_QUANTILE',
              query,
            },
          },
        },
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
    const expandQueryHints = getExpandRulesHints(query, datasource.ruleMappings);
    hints.push(...expandQueryHints);
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

export function getExpandRulesHints(query: string, mapping: RuleQueryMapping): QueryHint[] {
  const hints: QueryHint[] = [];
  const mappingForQuery = Object.keys(mapping).reduce((acc, ruleName) => {
    if (query.search(ruleName) === -1) {
      return acc;
    }

    if (mapping[ruleName].length > 1) {
      const { idx, expandedQuery, identifier, identifierValue } = getRecordingRuleIdentifierIdx(
        query,
        ruleName,
        mapping[ruleName]
      );

      // No identifier detected add warning
      if (idx === -1) {
        hints.push({
          type: 'EXPAND_RULES_WARNING',
          label:
            'We found multiple recording rules that match in this query. To expand the recording rule, add an identifier label/value.',
        });
        return acc;
      } else {
        // Identifier found.
        return {
          ...acc,
          [ruleName]: {
            expandedQuery,
            identifier,
            identifierValue,
          },
        };
      }
    } else {
      return {
        ...acc,
        [ruleName]: {
          expandedQuery: mapping[ruleName][0].query,
        },
      };
    }
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

  return hints;
}

export function getRecordingRuleIdentifierIdx(
  queryStr: string,
  ruleName: string,
  mapping: RuleQueryMapping[string]
): RecordingRuleIdentifier & { idx: number } {
  const { query } = buildVisualQueryFromString(queryStr);
  const queryMetricLabels: QueryBuilderLabelFilter[] = getQueryLabelsForRuleName(ruleName, query);
  if (queryMetricLabels.length === 0) {
    return { idx: -1, identifier: '', identifierValue: '', expandedQuery: '' };
  }

  let uuidLabel = '';
  let uuidLabelValue = '';
  let uuidLabelIdx = -1;

  queryMetricLabels.forEach((qml) => {
    if (uuidLabelIdx === -1 && qml.label.search('uuid') !== -1) {
      uuidLabel = qml.label;
      uuidLabelValue = qml.value;
    }
  });

  mapping.forEach((mp, idx) => {
    if (mp.labels) {
      Object.entries(mp.labels).forEach(([key, value]) => {
        if (uuidLabelIdx === -1 && key === uuidLabel && value === uuidLabelValue) {
          uuidLabelIdx = idx;
        }
      });
    }
  });

  return {
    idx: uuidLabelIdx,
    identifier: uuidLabel,
    identifierValue: uuidLabelValue,
    expandedQuery: mapping[uuidLabelIdx]?.query ?? '',
  };
}

// returns the labels of matching metric
// metricName is the ruleName in query
export function getQueryLabelsForRuleName(metricName: string, query: PromVisualQuery): QueryBuilderLabelFilter[] {
  if (query.metric === metricName) {
    return query.labels;
  } else {
    if (query.binaryQueries) {
      for (let i = 0; i < query.binaryQueries.length; i++) {
        const labels = getQueryLabelsForRuleName(metricName, query.binaryQueries[i].query);
        if (labels && labels.length > 0) {
          return labels;
        }
      }
    }
    return [];
  }
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
