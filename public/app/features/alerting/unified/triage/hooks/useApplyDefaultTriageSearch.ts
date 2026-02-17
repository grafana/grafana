import { useEffect } from 'react';

import { shouldUseTriageSavedSearches } from '../../featureToggles';
import { useAsync } from '../../hooks/useAsync';
import { applySavedSearch, serializeCurrentSearchState } from '../scene/triageSavedSearchUtils';

import { loadDefaultTriageSavedSearch, trackTriageSavedSearchAutoApply } from './useTriageSavedSearches';

/**
 * Session storage key to track if user has visited the triage page in current session.
 * Used to determine if we should auto-apply the default saved search.
 */
const SESSION_VISITED_KEY = 'grafana.alerting.triagePage.visited';

/**
 * Check if the triage page has active filters, groupBy, or non-default time range.
 *
 * This uses the URL parameters to determine if filters are active:
 * - var-filters: Ad-hoc filters
 * - var-groupBy: Group by selection
 *
 * Time range (from/to) is not considered when checking for active filters,
 * since the default time range is always applied.
 *
 * @returns true if there are active filters or groupBy selections
 */
function hasActiveTriageFilters(): boolean {
  const currentState = serializeCurrentSearchState();
  if (!currentState) {
    return false;
  }

  const params = new URLSearchParams(currentState);

  // Check for filters or groupBy - these indicate user has active selections
  const hasFilters = params.has('var-filters');
  const hasGroupBy = params.has('var-groupBy') && params.get('var-groupBy') !== '';

  return hasFilters || hasGroupBy;
}

/**
 * Hook that automatically applies the default saved search on first visit to the triage page.
 *
 * This hook:
 * - Checks if the saved searches feature is enabled (alertingTriageSavedSearches toggle)
 * - Detects if this is the first visit in the current session
 * - Only applies default if no filters/groupBy are currently active
 * - Loads and applies the default saved search if one exists
 * - Cleans up session storage on unmount
 *
 * The hook uses session storage to track visits, which:
 * - Persists across page refreshes (won't re-apply default)
 * - Clears when tab is closed (will apply default on next session)
 * - Clears on unmount (will apply default when navigating back)
 *
 * @returns Object with isApplying boolean indicating if the default search is being loaded/applied
 *
 * @example
 * ```tsx
 * function TriagePage() {
 *   const { isApplying } = useApplyDefaultTriageSearch();
 *
 *   if (isApplying) {
 *     return <LoadingIndicator />;
 *   }
 *
 *   return <TriageScene />;
 * }
 * ```
 */
export function useApplyDefaultTriageSearch(): { isApplying: boolean } {
  const savedSearchesEnabled = shouldUseTriageSavedSearches();
  const hasActiveFilters = hasActiveTriageFilters();

  // Use the internal useAsync hook which doesn't auto-execute
  const [{ execute }, state] = useAsync(async () => {
    const defaultSearch = await loadDefaultTriageSavedSearch();
    if (defaultSearch) {
      applySavedSearch(defaultSearch.query);
      trackTriageSavedSearchAutoApply();
    }
  });

  // Clear session storage on unmount
  useEffect(() => {
    return () => {
      clearSessionVisitedFlag();
    };
  }, []);

  const isFirstVisit = isFirstVisitInSession();
  const shouldLoadDefault = savedSearchesEnabled && !hasActiveFilters && isFirstVisit;

  // Mark as visited on first visit, regardless of whether we load defaults
  if (isFirstVisit && state.status === 'not-executed') {
    markAsVisited();

    // Execute only if we should load default
    if (shouldLoadDefault) {
      execute();
    }
  }

  return { isApplying: state.status === 'loading' };
}

/**
 * Check if this is a fresh navigation to the page (not a refresh or in-page URL change).
 * Uses session storage which persists across refreshes but clears when tab is closed.
 *
 * @returns true if this is the first visit to the page in this session
 */
function isFirstVisitInSession(): boolean {
  return !sessionStorage.getItem(SESSION_VISITED_KEY);
}

/**
 * Mark the page as visited in the current session.
 */
function markAsVisited(): void {
  sessionStorage.setItem(SESSION_VISITED_KEY, 'true');
}

/**
 * Clear the session visited flag. Call this when component unmounts
 * so the next navigation to this page is detected as a fresh visit.
 */
function clearSessionVisitedFlag(): void {
  sessionStorage.removeItem(SESSION_VISITED_KEY);
}
