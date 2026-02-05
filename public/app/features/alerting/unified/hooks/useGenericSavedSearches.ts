import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';

import { useAppNotification } from '../../../../core/copy/appNotification';
import { logError, logWarning } from '../Analytics';
import {
  SavedSearch,
  savedSearchSchema,
  savedSearchesArraySchema,
  validateSearchName,
} from '../components/saved-searches/savedSearchesSchema';

import { isLoading as isLoadingState, isUninitialized, useAsync } from './useAsync';

/**
 * Configuration for saved searches hook.
 */
export interface SavedSearchesConfig {
  /** Storage key for UserStorage (e.g., 'savedSearches', 'triageSavedSearches') */
  storageKey: string;
  /** Optional tracking context to add to all analytics events (e.g., { page: 'triage' }) */
  trackingContext?: Record<string, unknown>;
  /** Service namespace for UserStorage (default: 'alerting') */
  serviceNamespace?: string;
}

/**
 * Result of the useGenericSavedSearches hook.
 */
export interface UseGenericSavedSearchesResult {
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
 * Analytics tracking functions factory.
 * Creates tracking functions with optional context.
 */
function createTrackingFunctions(context: Record<string, unknown> = {}) {
  return {
    trackSave: (props: { hasDefault: boolean; totalCount: number }) =>
      reportInteraction('grafana_alerting_saved_search_save', { ...props, ...context }),
    trackApply: (props: { isDefault: boolean }) =>
      reportInteraction('grafana_alerting_saved_search_apply', { ...props, ...context }),
    trackDelete: () => reportInteraction('grafana_alerting_saved_search_delete', context),
    trackRename: () => reportInteraction('grafana_alerting_saved_search_rename', context),
    trackSetDefault: (props: { action: 'set' | 'clear' }) =>
      reportInteraction('grafana_alerting_saved_search_set_default', { ...props, ...context }),
    trackAutoApply: () => reportInteraction('grafana_alerting_saved_search_auto_apply', context),
  };
}

/**
 * Validates and parses an array of saved searches using zod schema.
 * Returns valid entries and logs warnings for invalid data.
 */
function validateSavedSearches(data: unknown, storageKey: string): SavedSearch[] {
  const result = savedSearchesArraySchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  // If the whole array failed, try to salvage individual valid entries
  if (!Array.isArray(data)) {
    logWarning(`Saved searches data for ${storageKey} is not an array, returning empty array`);
    return [];
  }

  logWarning(`Saved searches validation failed for ${storageKey}, filtering invalid entries`, {
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
 * Factory function to create a storage loader for a specific configuration.
 */
export function createStorageLoader(config: SavedSearchesConfig) {
  const userStorage = new UserStorage(config.serviceNamespace || 'alerting');

  return async (): Promise<SavedSearch[]> => {
    const stored = await userStorage.getItem(config.storageKey);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored);
      return validateSavedSearches(parsed, config.storageKey);
    } catch (error) {
      logError(error instanceof Error ? error : new Error('Failed to parse saved searches JSON'), {
        context: `createStorageLoader(${config.storageKey})`,
      });
      return [];
    }
  };
}

/**
 * Factory function to create a default search loader for a specific configuration.
 */
export function createDefaultLoader(config: SavedSearchesConfig) {
  const loadSavedSearches = createStorageLoader(config);

  return async (): Promise<SavedSearch | null> => {
    const savedSearches = await loadSavedSearches();
    return savedSearches.find((s) => s.isDefault) ?? null;
  };
}

/**
 * Generic hook for managing saved searches with UserStorage persistence.
 */
export function useGenericSavedSearches(config: SavedSearchesConfig): UseGenericSavedSearchesResult {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const notifyApp = useAppNotification();

  // Create UserStorage instance for this configuration
  const userStorage = useMemo(() => new UserStorage(config.serviceNamespace || 'alerting'), [config.serviceNamespace]);

  // Create tracking functions with optional context
  const tracking = useMemo(() => createTrackingFunctions(config.trackingContext), [config.trackingContext]);

  // Track whether we've already loaded to prevent double-loading
  const hasLoadedRef = useRef(false);

  // Create storage loader with current config
  const loadSavedSearches = useMemo(() => createStorageLoader(config), [config]);

  // Use useAsync for loading state management
  const [{ execute: executeLoad }, loadState] = useAsync(loadSavedSearches, []);
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
          context: `useGenericSavedSearches.loadSearches(${config.storageKey})`,
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
  }, [executeLoad, notifyApp, config.storageKey]);

  /**
   * Persist saved searches to UserStorage.
   */
  const persistSearches = useCallback(
    async (searches: SavedSearch[]): Promise<void> => {
      try {
        await userStorage.setItem(config.storageKey, JSON.stringify(searches));
      } catch (error) {
        logError(error instanceof Error ? error : new Error('Failed to save searches'), {
          context: `useGenericSavedSearches.persistSearches(${config.storageKey})`,
        });
        notifyApp.error(
          t('alerting.saved-searches.error-save-title', 'Failed to save'),
          t('alerting.saved-searches.error-save-description', 'Your changes could not be saved. Please try again.')
        );
        throw error;
      }
    },
    [userStorage, config.storageKey, notifyApp]
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
      tracking.trackSave({
        hasDefault: newSearches.some((s) => s.isDefault),
        totalCount: newSearches.length,
      });
    },
    [savedSearches, persistSearches, tracking]
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
      tracking.trackRename();
    },
    [savedSearches, persistSearches, tracking]
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
      tracking.trackDelete();
    },
    [savedSearches, persistSearches, tracking]
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
      tracking.trackSetDefault({ action: id === null ? 'clear' : 'set' });
    },
    [savedSearches, persistSearches, tracking]
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
 * Create a tracking function for when a saved search is applied.
 * @param trackingContext - Optional context to add to analytics event
 * @returns Function to track when a search is applied
 */
export function createAppliedTracker(trackingContext?: Record<string, unknown>) {
  const tracking = createTrackingFunctions(trackingContext);
  return (search: SavedSearch) => {
    tracking.trackApply({ isDefault: search.isDefault });
  };
}

/**
 * Create a tracking function for auto-apply events.
 * @param trackingContext - Optional context to add to analytics event
 * @returns Function to track auto-apply events
 */
export function createAutoApplyTracker(trackingContext?: Record<string, unknown>) {
  const tracking = createTrackingFunctions(trackingContext);
  return () => {
    tracking.trackAutoApply();
  };
}
