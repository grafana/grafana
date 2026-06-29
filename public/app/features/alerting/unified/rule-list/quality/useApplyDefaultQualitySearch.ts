import { useEffect } from 'react';

import { useAsync } from '../../hooks/useAsync';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { getSearchFilterFromQuery } from '../../search/rulesSearchParser';

import { loadDefaultQualitySearch, trackQualitySavedSearchAutoApply } from './useQualitySavedSearches';

/**
 * Session storage key to track if the user has visited the Alert quality tab in the
 * current session. Used to decide whether to auto-apply the default saved search.
 * Kept separate from the rule list's key so the two tabs don't interfere.
 */
const SESSION_VISITED_KEY = 'grafana.alerting.qualityList.visited';

/**
 * Hook that automatically applies the default Alert quality saved search on first visit.
 *
 * This hook:
 * - Detects if this is the first visit in the current session
 * - Loads and applies the default saved search if one exists and no filters are active
 * - Cleans up session storage on unmount
 *
 * @returns Object with isApplying boolean indicating if the default search is being loaded/applied
 */
export function useApplyDefaultQualitySearch(): { isApplying: boolean } {
  const { updateFilters, hasActiveFilters } = useRulesFilter();

  // useAsync doesn't auto-execute; we trigger it manually below.
  const [{ execute }, state] = useAsync(async () => {
    const defaultSearch = await loadDefaultQualitySearch();
    if (defaultSearch) {
      updateFilters(getSearchFilterFromQuery(defaultSearch.query));
      trackQualitySavedSearchAutoApply();
    }
  });

  // Clear session storage on unmount so the next navigation is a fresh visit.
  useEffect(() => {
    return () => {
      clearSessionVisitedFlag();
    };
  }, []);

  const isFirstVisit = isFirstVisitInSession();
  const shouldLoadDefault = !hasActiveFilters && isFirstVisit;

  // Mark as visited on first visit, regardless of whether we load defaults.
  if (isFirstVisit && state.status === 'not-executed') {
    markAsVisited();

    if (shouldLoadDefault) {
      execute();
    }
  }

  return { isApplying: state.status === 'loading' };
}

/**
 * Check if this is a fresh navigation to the page (not a refresh or in-page URL change).
 * Uses session storage which persists across refreshes but clears when the tab is closed.
 */
function isFirstVisitInSession(): boolean {
  return !sessionStorage.getItem(SESSION_VISITED_KEY);
}

function markAsVisited(): void {
  sessionStorage.setItem(SESSION_VISITED_KEY, 'true');
}

function clearSessionVisitedFlag(): void {
  sessionStorage.removeItem(SESSION_VISITED_KEY);
}
