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
  if (isNotFoundError(error)) {
    return null;
  }

  throw error;
}

export function isNotFoundError(error: unknown): boolean {
  return isFetchError(error) && error.status === 404;
}
