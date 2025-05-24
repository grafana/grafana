import Prism from 'prismjs';

import { AbstractLabelMatcher, AbstractLabelOperator, AbstractQuery } from '@grafana/data';

import { extractLabelMatchers, getClientCacheDurationInMinutes, toPromLikeQuery } from './language_utils';
import PromqlSyntax from './promql';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { PrometheusCacheLevel, PromQuery } from './types';
import { isValidLegacyName } from './utf8_support';

export const importFromAbstractQuery = (labelBasedQuery: AbstractQuery): PromQuery => {
  return toPromLikeQuery(labelBasedQuery);
};

export const exportToAbstractQuery = (query: PromQuery): AbstractQuery => {
  const promQuery = query.expr;
  if (!promQuery || promQuery.length === 0) {
    return { refId: query.refId, labelMatchers: [] };
  }
  const tokens = Prism.tokenize(promQuery, PromqlSyntax);
  const labelMatchers: AbstractLabelMatcher[] = extractLabelMatchers(tokens);
  const nameLabelValue = getNameLabelValue(promQuery, tokens);
  if (nameLabelValue && nameLabelValue.length > 0) {
    labelMatchers.push({
      name: '__name__',
      operator: AbstractLabelOperator.Equal,
      value: nameLabelValue,
    });
  }

  return {
    refId: query.refId,
    labelMatchers,
  };
};

/**
 * Checks if an error is a cancelled request error.
 * Used to avoid logging cancelled request errors.
 *
 * @param {unknown} error - Error to check
 * @returns {boolean} True if the error is a cancelled request error
 */
export const isCancelledError = (error: unknown): error is { cancelled: boolean } => {
  return typeof error === 'object' && error !== null && 'cancelled' in error && error.cancelled === true;
};

/**
 * Removes quotes from a string if they exist.
 * Used to handle utf8 label keys in Prometheus queries.
 *
 * @param {string} input - Input string that may have surrounding quotes
 * @returns {string} String with surrounding quotes removed if they existed
 */
export const removeQuotesIfExist = (input: string): string => {
  const match = input.match(/^"(.*)"$/); // extract the content inside the quotes
  return match?.[1] ?? input;
};

/**
 * Builds cache headers for Prometheus API requests.
 *
 * @param {number} durationInSeconds - Cache duration in seconds
 * @returns {object} Object with headers property containing cache headers
 */
export const buildCacheHeaders = (durationInSeconds: number) => {
  return {
    headers: {
      'X-Grafana-Cache': `private, max-age=${durationInSeconds}`,
    },
  };
};

/**
 * Gets appropriate cache headers based on the configured cache level.
 * Returns undefined if caching is disabled.
 *
 * @param {PrometheusCacheLevel} cacheLevel - Cache level (None, Low, Medium, High)
 * @returns {object|undefined} Cache headers object or undefined if caching is disabled
 */
export const getDefaultCacheHeaders = (cacheLevel: PrometheusCacheLevel) => {
  if (cacheLevel !== PrometheusCacheLevel.None) {
    return buildCacheHeaders(getClientCacheDurationInMinutes(cacheLevel) * 60);
  }
  return;
};

/**
 * Extracts metrics from queries and populates match parameters.
 * This is used to filter time series data based on existing queries.
 * Handles UTF8 metrics by properly escaping them.
 *
 * @param {URLSearchParams} initialParams - Initial URL parameters
 * @param {PromQuery[]} queries - Array of Prometheus queries
 * @returns {URLSearchParams} URL parameters with match[] parameters added
 */
export const populateMatchParamsFromQueries = (
  initialParams: URLSearchParams,
  queries?: PromQuery[]
): URLSearchParams => {
  return (queries ?? []).reduce((params, query) => {
    const visualQuery = buildVisualQueryFromString(query.expr);
    const isUtf8Metric = !isValidLegacyName(visualQuery.query.metric);
    params.append('match[]', isUtf8Metric ? `{"${visualQuery.query.metric}"}` : visualQuery.query.metric);
    if (visualQuery.query.binaryQueries) {
      visualQuery.query.binaryQueries.forEach((bq) => {
        params.append('match[]', isUtf8Metric ? `{"${bq.query.metric}"}` : bq.query.metric);
      });
    }
    return params;
  }, initialParams);
};

function getNameLabelValue(promQuery: string, tokens: Array<string | Prism.Token>): string {
  let nameLabelValue = '';

  for (const token of tokens) {
    if (typeof token === 'string') {
      nameLabelValue = token;
      break;
    }
  }
  return nameLabelValue;
}
