import { useEffect } from 'react';
import { useAsync } from 'react-use';

import { shouldUseSavedSearches } from '../../featureToggles';
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

  // Clear session storage on unmount
  useEffect(() => {
    return () => {
      clearSessionVisitedFlag();
    };
  }, []);

  // Only attempt to load default search when feature is enabled, no filters are active,
  // and this is the first visit in the session (checked via session storage)
  const isFirstVisit = isFirstVisitInSession();
  const shouldLoadDefault = savedSearchesEnabled && !hasActiveFilters && isFirstVisit;

  const defaultSearchState = useAsync(async () => {
    markAsVisited();

    if (!shouldLoadDefault) {
      return;
    }

    const defaultSearch = await loadDefaultSavedSearch();
    if (defaultSearch) {
      updateFilters(getSearchFilterFromQuery(defaultSearch.query));
      trackSavedSearchAutoApply();
    }
  }, [shouldLoadDefault]);

  const isApplying = shouldLoadDefault && defaultSearchState.loading;

  return { isApplying };
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
