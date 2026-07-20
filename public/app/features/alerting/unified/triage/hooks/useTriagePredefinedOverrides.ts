import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import z from 'zod';

import { UserStorage } from '@grafana/runtime/internal';

import { logError } from '../../Analytics';
import { isLoading as isLoadingState, isUninitialized, useAsync } from '../../hooks/useAsync';
import { parseJsonWithSchema } from '../../utils/parseJsonWithSchema';

const STORAGE_NAMESPACE = 'alerting';
const KEY_NAME_OVERRIDES = 'triagePredefinedNameOverrides';
const KEY_DISMISSED = 'triagePredefinedDismissed';
/** Storage key for default search ID (used by loadDefaultTriageSavedSearch to resolve predefined or user default). */
export const TRIAGE_DEFAULT_SEARCH_ID_STORAGE_KEY = 'triageDefaultSearchId';

export interface UseTriagePredefinedOverridesResult {
  /** Custom names for predefined search IDs */
  nameOverrides: Record<string, string>;
  /** Predefined search IDs the user has dismissed (hidden from list) */
  dismissedIds: string[];
  /** ID of the saved search set as default (predefined or user-created), or null */
  defaultSearchId: string | null;
  /** Whether the initial load from storage is complete */
  isLoading: boolean;
  /** Set a custom name for a predefined search */
  setNameOverride: (id: string, name: string) => Promise<void>;
  /** Dismiss (hide) a predefined search from the list */
  dismissId: (id: string) => Promise<void>;
  /** Set or clear the default search ID (persisted so predefined or user default works the same) */
  setDefaultSearchId: (id: string | null) => Promise<void>;
}

const nameOverridesSchema = z.record(z.string(), z.string());
const dismissedIdsSchema = z.array(z.string());
const defaultSearchIdSchema = z.string().min(1).nullable();

/** Data shape returned by the predefined overrides loader. */
export interface TriagePredefinedOverridesData {
  nameOverrides: Record<string, string>;
  dismissedIds: string[];
  defaultSearchId: string | null;
}

/**
 * Factory function to create a loader for triage predefined overrides.
 * Mirrors createStorageLoader in useGenericSavedSearches for consistent patterns.
 * Can be reused by loadDefaultTriageSavedSearch or other callers that need override data.
 */
export function createPredefinedOverridesLoader(): () => Promise<TriagePredefinedOverridesData> {
  const userStorage = new UserStorage(STORAGE_NAMESPACE);

  return async (): Promise<TriagePredefinedOverridesData> => {
    const [overridesRaw, dismissedRaw, defaultIdRaw] = await Promise.all([
      userStorage.getItem(KEY_NAME_OVERRIDES),
      userStorage.getItem(KEY_DISMISSED),
      userStorage.getItem(TRIAGE_DEFAULT_SEARCH_ID_STORAGE_KEY),
    ]);
    return {
      nameOverrides: parseJsonWithSchema(overridesRaw, nameOverridesSchema, {}),
      dismissedIds: parseJsonWithSchema(dismissedRaw, dismissedIdsSchema, []),
      defaultSearchId: parseJsonWithSchema(defaultIdRaw, defaultSearchIdSchema, null),
    };
  };
}

/**
 * Hook for persisting user customisations to predefined triage saved searches:
 * custom names (rename) and dismissed IDs (delete = hide from list).
 */
export function useTriagePredefinedOverrides(): UseTriagePredefinedOverridesResult {
  const [nameOverrides, setNameOverridesState] = useState<Record<string, string>>({});
  const [dismissedIds, setDismissedIdsState] = useState<string[]>([]);
  const [defaultSearchId, setDefaultSearchIdState] = useState<string | null>(null);

  const userStorage = useMemo(() => new UserStorage(STORAGE_NAMESPACE), []);
  const hasLoadedRef = useRef(false);

  const loadOverrides = useMemo(() => createPredefinedOverridesLoader(), []);
  const [{ execute: executeLoad }, loadState] = useAsync(loadOverrides);
  const isLoading = isLoadingState(loadState) || isUninitialized(loadState);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    const apply = async () => {
      try {
        const data = await executeLoad();
        if (data) {
          setNameOverridesState(data.nameOverrides);
          setDismissedIdsState(data.dismissedIds);
          setDefaultSearchIdState(data.defaultSearchId);
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error('Failed to load predefined overrides from storage'), {
          context: 'useTriagePredefinedOverrides.loadOverrides',
        });
      }
    };

    apply();
  }, [executeLoad]);

  const persistOverrides = useCallback(
    async (next: Record<string, string>) => {
      await userStorage.setItem(KEY_NAME_OVERRIDES, JSON.stringify(next));
    },
    [userStorage]
  );

  const persistDismissed = useCallback(
    async (next: string[]) => {
      await userStorage.setItem(KEY_DISMISSED, JSON.stringify(next));
    },
    [userStorage]
  );

  const setNameOverride = useCallback(
    async (id: string, name: string) => {
      const next = { ...nameOverrides, [id]: name };
      setNameOverridesState(next);
      await persistOverrides(next);
    },
    [nameOverrides, persistOverrides]
  );

  const dismissId = useCallback(
    async (id: string) => {
      const next = dismissedIds.includes(id) ? dismissedIds : [...dismissedIds, id];
      setDismissedIdsState(next);
      await persistDismissed(next);
    },
    [dismissedIds, persistDismissed]
  );

  const setDefaultSearchId = useCallback(
    async (id: string | null) => {
      setDefaultSearchIdState(id);
      await userStorage.setItem(TRIAGE_DEFAULT_SEARCH_ID_STORAGE_KEY, JSON.stringify(id));
    },
    [userStorage]
  );

  return {
    nameOverrides,
    dismissedIds,
    defaultSearchId,
    isLoading,
    setNameOverride,
    dismissId,
    setDefaultSearchId,
  };
}
