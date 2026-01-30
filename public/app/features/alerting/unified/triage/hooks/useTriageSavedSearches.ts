import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';

import { useAppNotification } from '../../../../../core/copy/appNotification';
import { logError, logWarning } from '../../Analytics';
import {
  SavedSearch,
  TRIAGE_SAVED_SEARCHES_STORAGE_KEY,
  savedSearchSchema,
  savedSearchesArraySchema,
  validateSearchName,
} from '../../components/saved-searches/savedSearchesSchema';
import { isLoading as isLoadingState, isUninitialized, useAsync } from '../../hooks/useAsync';

/**
 * UserStorage instance for triage saved searches.
 * Uses 'alerting' as the service namespace.
 */
const userStorage = new UserStorage('alerting');

/**
 * Analytics tracking functions for triage saved search actions.
 * All events include page: 'triage' to distinguish from Alert Rules page.
 */
function trackTriageSavedSearchSave(props: { hasDefault: boolean; totalCount: number }) {
  reportInteraction('grafana_alerting_saved_search_save', { ...props, page: 'triage' });
}

function trackTriageSavedSearchApply(props: { isDefault: boolean }) {
  reportInteraction('grafana_alerting_saved_search_apply', { ...props, page: 'triage' });
}

function trackTriageSavedSearchDelete() {
  reportInteraction('grafana_alerting_saved_search_delete', { page: 'triage' });
}

function trackTriageSavedSearchRename() {
  reportInteraction('grafana_alerting_saved_search_rename', { page: 'triage' });
}

function trackTriageSavedSearchSetDefault(props: { action: 'set' | 'clear' }) {
  reportInteraction('grafana_alerting_saved_search_set_default', { ...props, page: 'triage' });
}

export function trackTriageSavedSearchAutoApply() {
  reportInteraction('grafana_alerting_saved_search_auto_apply', { page: 'triage' });
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
    logWarning('Triage saved searches data is not an array, returning empty array');
    return [];
  }

  logWarning('Triage saved searches validation failed, filtering invalid entries', {
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
 * Loads triage saved searches from UserStorage and validates the data.
 * @returns Promise resolving to an array of valid saved searches
 */
async function loadTriageSavedSearchesFromStorage(): Promise<SavedSearch[]> {
  const stored = await userStorage.getItem(TRIAGE_SAVED_SEARCHES_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return validateSavedSearches(parsed);
  } catch (error) {
    logError(error instanceof Error ? error : new Error('Failed to parse triage saved searches JSON'), {
      context: 'loadTriageSavedSearchesFromStorage',
    });
    // Re-throw so the caller can show an error notification to the user
    throw error;
  }
}

export async function loadDefaultTriageSavedSearch(): Promise<SavedSearch | null> {
  const savedSearches = await loadTriageSavedSearchesFromStorage();
  return savedSearches.find((s) => s.isDefault) ?? null;
}

/**
 * Result of the useTriageSavedSearches hook.
 */
export interface UseTriageSavedSearchesResult {
  /** List of saved searches */
  savedSearches: SavedSearch[];
  /** Whether the initial load from storage is complete */
  isLoading: boolean;
  /**
   * Save a new search with the given name and query.
   * @param name - The display name for the saved search
   * @param query - The search query string (serialized URL params for triage)
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
 * Hook for managing triage page saved searches with UserStorage persistence.
 *
 * This hook is specific to the Alert Activity (Triage) page and uses a separate
 * storage key from the Alert Rules page. The `query` field stores serialized
 * URL parameters (filters, groupBy, time range).
 *
 * Features:
 * - Persists saved searches to UserStorage (syncs across devices)
 * - Validates data schema on load (filters invalid entries)
 * - Validates name uniqueness (case-insensitive)
 * - Tracks analytics for all actions with page: 'triage'
 * - Shows error notifications on storage failures
 *
 * @example
 * ```tsx
 * const { savedSearches, saveSearch, isLoading } = useTriageSavedSearches();
 *
 * // Save current state (serialized URL params)
 * const currentQuery = serializeTriageState();
 * await saveSearch('My Filters', currentQuery);
 * ```
 */
export function useTriageSavedSearches(): UseTriageSavedSearchesResult {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const notifyApp = useAppNotification();

  // Track whether we've already loaded to prevent double-loading
  const hasLoadedRef = useRef(false);

  // Use useAsync for loading state management
  const [{ execute: executeLoad }, loadState] = useAsync(loadTriageSavedSearchesFromStorage, []);
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
        logError(error instanceof Error ? error : new Error('Failed to load triage saved searches from storage'), {
          context: 'useTriageSavedSearches.loadSearches',
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
        await userStorage.setItem(TRIAGE_SAVED_SEARCHES_STORAGE_KEY, JSON.stringify(searches));
      } catch (error) {
        logError(error instanceof Error ? error : new Error('Failed to save triage searches'), {
          context: 'useTriageSavedSearches.persistSearches',
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
      trackTriageSavedSearchSave({
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
      trackTriageSavedSearchRename();
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
      trackTriageSavedSearchDelete();
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
      trackTriageSavedSearchSetDefault({ action: id === null ? 'clear' : 'set' });
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
 * Track when a triage saved search is applied (called from parent component).
 * @param search - The search that was applied
 */
export function trackTriageSavedSearchApplied(search: SavedSearch) {
  trackTriageSavedSearchApply({ isDefault: search.isDefault });
}
