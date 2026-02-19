import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';

import { useAppNotification } from '../../../../../core/copy/appNotification';
import { logError, logWarning } from '../../Analytics';
import { isLoading as isLoadingState, isUninitialized, useAsync } from '../../hooks/useAsync';

import { SavedSearch, savedSearchSchema, savedSearchesArraySchema, validateSearchName } from './savedSearchesSchema';

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

export function trackSavedSearchAutoApply() {
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
    logWarning('Saved searches data is not an array, returning empty array');
    return [];
  }

  logWarning('Saved searches validation failed, filtering invalid entries', {
    issues: JSON.stringify(result.error.issues),
  });

  const validEntries: SavedSearch[] = [];
  for (const item of data) {
    const itemResult = savedSearchSchema.safeParse(item);
    if (itemResult.success) {
      validEntries.push(itemResult.data);
    }
  }
  return validEntries;
}

/**
 * Sorts saved searches: default search first, then others alphabetically.
 * @param searches - Array of saved searches to sort
 * @returns Sorted array with default first, then alphabetically by name
 */
function sortSavedSearches(searches: SavedSearch[]): SavedSearch[] {
  const defaultSearch = searches.find((s) => s.isDefault);
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  const others = searches.filter((s) => !s.isDefault).sort((a, b) => collator.compare(a.name, b.name));

  return defaultSearch ? [defaultSearch, ...others] : others;
}

/**
 * Loads saved searches from UserStorage and validates the data.
 * @returns Promise resolving to an array of valid saved searches
 */
async function loadSavedSearchesFromStorage(): Promise<SavedSearch[]> {
  const stored = await userStorage.getItem(SAVED_SEARCHES_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  const parsed = JSON.parse(stored);
  return validateSavedSearches(parsed);
}

export async function loadDefaultSavedSearch(): Promise<SavedSearch | null> {
  const savedSearches = await loadSavedSearchesFromStorage();
  return savedSearches.find((s) => s.isDefault) ?? null;
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
   * @throws ValidationError if name is not unique
   */
  saveSearch: (name: string, query: string) => Promise<void>;
  /**
   * Rename an existing saved search.
   * @param id - The ID of the search to rename
   * @param newName - The new display name
   * @throws ValidationError if name is not unique
   */
  renameSearch: (id: string, newName: string) => Promise<void>;
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

  // Use useAsync for loading state management
  const [{ execute: executeLoad }, loadState] = useAsync(loadSavedSearchesFromStorage, []);
  const isLoading = isLoadingState(loadState) || isUninitialized(loadState);

  // Load saved searches from storage on mount
  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    // Load from UserStorage using async/await pattern
    const loadSearches = async () => {
      try {
        const validated = await executeLoad();
        setSavedSearches(validated);
      } catch (error) {
        logError(error instanceof Error ? error : new Error('Failed to load saved searches from storage'), {
          context: 'useSavedSearches.loadSearches',
        });
        notifyApp.error(
          t('alerting.saved-searches.error-load-title', 'Failed to load saved searches'),
          t(
            'alerting.saved-searches.error-load-description',
            'Your saved searches could not be loaded. Please try refreshing the page.'
          )
        );
      }
    };

    loadSearches();
  }, [executeLoad, notifyApp]);

  /**
   * Persist saved searches to UserStorage.
   */
  const persistSearches = useCallback(
    async (searches: SavedSearch[]): Promise<void> => {
      try {
        await userStorage.setItem(SAVED_SEARCHES_STORAGE_KEY, JSON.stringify(searches));
      } catch (error) {
        logError(error instanceof Error ? error : new Error('Failed to save searches'), {
          context: 'useSavedSearches.persistSearches',
        });
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
   * @throws ValidationError if the name is not unique
   */
  const saveSearch = useCallback(
    async (name: string, query: string): Promise<void> => {
      // Validate name using shared validation function
      const validationError = validateSearchName(name, savedSearches);
      if (validationError) {
        throw { field: 'name' as const, message: validationError };
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
    },
    [savedSearches, persistSearches]
  );

  /**
   * Rename an existing saved search.
   * @throws ValidationError if the new name is not unique
   */
  const renameSearch = useCallback(
    async (id: string, newName: string): Promise<void> => {
      // Validate name using shared validation function (excluding current item)
      const validationError = validateSearchName(newName, savedSearches, id);
      if (validationError) {
        throw { field: 'name' as const, message: validationError };
      }

      const newSearches = savedSearches.map((s) => (s.id === id ? { ...s, name: newName } : s));

      await persistSearches(newSearches);
      setSavedSearches(newSearches);

      // Track analytics
      trackSavedSearchRename();
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

  // Sort saved searches: default first, then alphabetically by name
  const sortedSavedSearches = useMemo(() => sortSavedSearches(savedSearches), [savedSearches]);

  return {
    savedSearches: sortedSavedSearches,
    isLoading,
    saveSearch,
    renameSearch,
    deleteSearch,
    setDefaultSearch,
  };
}

/**
 * Track when a saved search is applied (called from parent component).
 * @param search - The search that was applied
 */
export function trackSavedSearchApplied(search: SavedSearch) {
  trackSavedSearchApply({ isDefault: search.isDefault });
}
