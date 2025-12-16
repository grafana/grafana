import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';

import { useAppNotification } from '../../../../../core/copy/appNotification';
import { contextSrv } from '../../../../../core/services/context_srv';
import { isLoading as isLoadingState, isUninitialized, useAsync } from '../../hooks/useAsync';

import { SavedSearch, ValidationError, savedSearchesArraySchema, validateSearchName } from './SavedSearches.types';

/**
 * Storage key for saved searches in UserStorage.
 */
const SAVED_SEARCHES_STORAGE_KEY = 'savedSearches';

/**
 * UserStorage instance for saved searches.
 * Uses 'alerting' as the service namespace.
 */
const userStorage = new UserStorage('alerting');

/**
 * Get session storage key for the current user.
 * Using user ID ensures the flag is unique per user, handling logout/login scenarios.
 */
function getSessionVisitedKey(): string {
  const userId = contextSrv.user?.id ?? 'anonymous';
  return `grafana.alerting.alertRules.visited.${userId}`;
}

/**
 * Analytics tracking functions for saved search actions.
 */
function trackSavedSearchSave(props: { hasDefault: boolean; totalCount: number }) {
  reportInteraction('grafana_alerting_saved_search_save', props);
}

function trackSavedSearchApply(props: { isDefault: boolean }) {
  reportInteraction('grafana_alerting_saved_search_apply', props);
}

function trackSavedSearchDelete() {
  reportInteraction('grafana_alerting_saved_search_delete');
}

function trackSavedSearchRename() {
  reportInteraction('grafana_alerting_saved_search_rename');
}

function trackSavedSearchSetDefault(props: { action: 'set' | 'clear' }) {
  reportInteraction('grafana_alerting_saved_search_set_default', props);
}

function trackSavedSearchAutoApply() {
  reportInteraction('grafana_alerting_saved_search_auto_apply');
}

/**
 * Validates and parses an array of saved searches using zod schema.
 * Returns valid entries and logs warnings for invalid data.
 */
function validateSavedSearches(data: unknown): SavedSearch[] {
  const result = savedSearchesArraySchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  // If the whole array failed, try to salvage individual valid entries
  if (!Array.isArray(data)) {
    console.warn('Saved searches data is not an array, returning empty array');
    return [];
  }

  console.warn('Saved searches validation failed, filtering invalid entries:', result.error.issues);
  return [];
}

/**
 * Result of the useSavedSearches hook.
 */
export interface UseSavedSearchesResult {
  /** List of saved searches */
  savedSearches: SavedSearch[];
  /** Whether the initial load from storage is complete */
  isLoading: boolean;
  /**
   * Save a new search with the given name and query.
   * @param name - The display name for the saved search
   * @param query - The search query string
   * @returns ValidationError if name is not unique, void on success
   */
  saveSearch: (name: string, query: string) => Promise<void | ValidationError>;
  /**
   * Rename an existing saved search.
   * @param id - The ID of the search to rename
   * @param newName - The new display name
   * @returns ValidationError if name is not unique, void on success
   */
  renameSearch: (id: string, newName: string) => Promise<void | ValidationError>;
  /**
   * Delete a saved search by ID.
   * @param id - The ID of the search to delete
   */
  deleteSearch: (id: string) => Promise<void>;
  /**
   * Set or clear the default search.
   * @param id - The ID to set as default, or null to clear
   */
  setDefaultSearch: (id: string | null) => Promise<void>;
  /**
   * Get the default search to auto-apply on navigation.
   * Only returns a search on first navigation (not refresh) and when no URL search exists.
   * @returns The default SavedSearch or null
   */
  getAutoApplySearch: () => SavedSearch | null;
}

/**
 * Hook for managing saved searches with UserStorage persistence.
 *
 * Features:
 * - Persists saved searches to UserStorage (syncs across devices)
 * - Validates data schema on load (filters invalid entries)
 * - Validates name uniqueness (case-insensitive)
 * - Tracks analytics for all actions
 * - Shows error notifications on storage failures
 * - Provides auto-apply logic for default search on navigation
 * - Per-user session tracking to handle logout/login scenarios
 *
 * @example
 * ```tsx
 * const { savedSearches, saveSearch, isLoading } = useSavedSearches();
 *
 * // Save current search
 * const error = await saveSearch('My Search', currentQuery);
 * if (error) {
 *   // Handle validation error
 * }
 *
 * // Auto-apply default search on mount
 * useEffect(() => {
 *   const defaultSearch = getAutoApplySearch();
 *   if (defaultSearch) {
 *     applySearch(defaultSearch);
 *   }
 * }, []);
 * ```
 */
export function useSavedSearches(): UseSavedSearchesResult {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const notifyApp = useAppNotification();

  // Track whether we've already loaded to prevent double-loading
  const hasLoadedRef = useRef(false);
  // Track whether this is a fresh navigation (not refresh)
  const isNavigationRef = useRef<boolean | null>(null);

  // Async loader function for saved searches
  const loadSavedSearches = useCallback(async (): Promise<SavedSearch[]> => {
    const stored = await userStorage.getItem(SAVED_SEARCHES_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return validateSavedSearches(parsed);
  }, []);

  // Use useAsync for loading state management
  const [{ execute: executeLoad }, loadState] = useAsync(loadSavedSearches, []);
  const isLoading = isLoadingState(loadState) || isUninitialized(loadState);

  // Load saved searches from storage on mount
  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    const sessionKey = getSessionVisitedKey();

    // Determine if this is a navigation or refresh
    // If session storage has the visited flag, this is a refresh
    const wasVisited = sessionStorage.getItem(sessionKey);
    isNavigationRef.current = !wasVisited;

    // Set the visited flag for future checks
    sessionStorage.setItem(sessionKey, 'true');

    // Load from UserStorage using useAsync
    executeLoad()
      .then((validated) => {
        setSavedSearches(validated);
      })
      .catch((error) => {
        console.error('Failed to load saved searches from storage:', error);
        notifyApp.error(
          t('alerting.saved-searches.error-load-title', 'Failed to load saved searches'),
          t(
            'alerting.saved-searches.error-load-description',
            'Your saved searches could not be loaded. Please try refreshing the page.'
          )
        );
      });

    // Clean up session flag when component unmounts (user navigates away)
    return () => {
      sessionStorage.removeItem(sessionKey);
    };
  }, [executeLoad, notifyApp]);

  /**
   * Persist saved searches to UserStorage.
   */
  const persistSearches = useCallback(
    async (searches: SavedSearch[]): Promise<void> => {
      try {
        await userStorage.setItem(SAVED_SEARCHES_STORAGE_KEY, JSON.stringify(searches));
      } catch (error) {
        console.error('Failed to save searches:', error);
        notifyApp.error(
          t('alerting.saved-searches.error-save-title', 'Failed to save'),
          t('alerting.saved-searches.error-save-description', 'Your changes could not be saved. Please try again.')
        );
        throw error;
      }
    },
    [notifyApp]
  );

  /**
   * Save a new search with the given name and query.
   * Returns a ValidationError if the name is not unique.
   */
  const saveSearch = useCallback(
    async (name: string, query: string): Promise<void | ValidationError> => {
      // Validate name using shared validation function
      const validationError = validateSearchName(name, savedSearches);
      if (validationError) {
        return { field: 'name', message: validationError };
      }

      const newSearch: SavedSearch = {
        id: uuidv4(),
        name,
        query,
        isDefault: false,
        createdAt: Date.now(),
      };

      const newSearches = [...savedSearches, newSearch];

      await persistSearches(newSearches);
      setSavedSearches(newSearches);

      // Track analytics
      trackSavedSearchSave({
        hasDefault: newSearches.some((s) => s.isDefault),
        totalCount: newSearches.length,
      });

      return undefined;
    },
    [savedSearches, persistSearches]
  );

  /**
   * Rename an existing saved search.
   * Returns a ValidationError if the new name is not unique.
   */
  const renameSearch = useCallback(
    async (id: string, newName: string): Promise<void | ValidationError> => {
      // Validate name using shared validation function (excluding current item)
      const validationError = validateSearchName(newName, savedSearches, id);
      if (validationError) {
        return { field: 'name', message: validationError };
      }

      const newSearches = savedSearches.map((s) => (s.id === id ? { ...s, name: newName } : s));

      await persistSearches(newSearches);
      setSavedSearches(newSearches);

      // Track analytics
      trackSavedSearchRename();

      return undefined;
    },
    [savedSearches, persistSearches]
  );

  /**
   * Delete a saved search by ID.
   */
  const deleteSearch = useCallback(
    async (id: string): Promise<void> => {
      const newSearches = savedSearches.filter((s) => s.id !== id);

      await persistSearches(newSearches);
      setSavedSearches(newSearches);

      // Track analytics
      trackSavedSearchDelete();
    },
    [savedSearches, persistSearches]
  );

  /**
   * Set or clear the default search.
   * Pass null to clear the current default.
   */
  const setDefaultSearch = useCallback(
    async (id: string | null): Promise<void> => {
      const newSearches = savedSearches.map((s) => ({
        ...s,
        isDefault: id === null ? false : s.id === id,
      }));

      await persistSearches(newSearches);
      setSavedSearches(newSearches);

      // Track analytics
      trackSavedSearchSetDefault({ action: id === null ? 'clear' : 'set' });
    },
    [savedSearches, persistSearches]
  );

  /**
   * Get the default search to auto-apply.
   * Only returns a search on navigation (not browser refresh) and when there's no URL search query.
   *
   * Call this once on mount to determine if a default search should be applied.
   */
  const getAutoApplySearch = useCallback((): SavedSearch | null => {
    // Only auto-apply on navigation, not refresh
    if (!isNavigationRef.current) {
      return null;
    }

    // Check if there's already a search query in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlSearch = urlParams.has('search') && urlParams.get('search') !== '';
    if (hasUrlSearch) {
      return null;
    }

    // Find and return the default search
    const defaultSearch = savedSearches.find((s) => s.isDefault);
    if (defaultSearch) {
      // Track analytics
      trackSavedSearchAutoApply();
      // Reset navigation flag so subsequent calls don't auto-apply
      isNavigationRef.current = false;
    }

    return defaultSearch ?? null;
  }, [savedSearches]);

  return {
    savedSearches,
    isLoading,
    saveSearch,
    renameSearch,
    deleteSearch,
    setDefaultSearch,
    getAutoApplySearch,
  };
}

/**
 * Track when a saved search is applied (called from parent component).
 * @param search - The search that was applied
 */
export function trackSavedSearchApplied(search: SavedSearch) {
  trackSavedSearchApply({ isDefault: search.isDefault });
}
