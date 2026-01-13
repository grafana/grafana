import { useEffect } from 'react';

import { shouldUseSavedSearches } from '../../featureToggles';
import { useAsync } from '../../hooks/useAsync';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { getSearchFilterFromQuery } from '../../search/rulesSearchParser';

import { loadDefaultSavedSearch, trackSavedSearchAutoApply } from './useSavedSearches';

/**
 * Session storage key to track if user has visited this page in current session.
 * Used to determine if we should auto-apply the default saved search.
 */
const SESSION_VISITED_KEY = 'grafana.alerting.ruleList.visited';

/**
 * Hook that automatically applies the default saved search on first visit to the page.
 *
 * This hook:
 * - Checks if saved searches feature is enabled
 * - Detects if this is the first visit in the current session
 * - Loads and applies the default saved search if one exists
 * - Cleans up session storage on unmount
 *
 * @returns Object with isApplying boolean indicating if the default search is being loaded/applied
 */
export function useApplyDefaultSearch(): { isApplying: boolean } {
  const savedSearchesEnabled = shouldUseSavedSearches();
  const { updateFilters, hasActiveFilters } = useRulesFilter();

  // Use the internal useAsync hook which doesn't auto-execute
  const [{ execute }, state] = useAsync(async () => {
    const defaultSearch = await loadDefaultSavedSearch();
    if (defaultSearch) {
      updateFilters(getSearchFilterFromQuery(defaultSearch.query));
      trackSavedSearchAutoApply();
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
