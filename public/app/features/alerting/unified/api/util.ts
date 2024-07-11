import { isFetchError } from '@grafana/runtime';

/**
 * Catch 404 error response and return "null" instead.
 *
 * @example
 * const ruleGroup = await fetchRuleGroup()
 *   .unwrap()
 *   .catch(notFoundToNull); // RuleGroupDTO | null
 */
export function notFoundToNullOrThrow(error: unknown): null {
  if (isFetchError(error) && error.status === 404) {
    return null;
  }

  throw error;
}
