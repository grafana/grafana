import { useCallback } from 'react';

/**
 * Session storage key prefix for persisting transformation row collapse states.
 * Full key format: grafana.panelEditor.transformations.${dashboardUID}-${panelKey}
 */
export const TRANSFORMATION_ROWS_STATE_KEY = 'grafana.panelEditor.transformations';

/**
 * Persists transformation row collapse states in sessionStorage.
 * Scoped by dashboard UID and panel ID for uniqueness across dashboards.
 * Reads/writes directly from sessionStorage.
 */
export function usePersistedTransformationState(storageKey: string) {
  const fullStorageKey = `${TRANSFORMATION_ROWS_STATE_KEY}.${storageKey}`;

  const isOpen = useCallback(
    (transformationId: string): boolean | undefined => {
      try {
        const stored = sessionStorage.getItem(fullStorageKey);
        if (!stored) {
          return undefined;
        }
        const rowStates = JSON.parse(stored);
        return rowStates[transformationId];
      } catch {
        return undefined;
      }
    },
    [fullStorageKey]
  );

  const setIsOpen = useCallback(
    (transformationId: string, open: boolean) => {
      try {
        const stored = sessionStorage.getItem(fullStorageKey);
        const rowStates = stored ? JSON.parse(stored) : {};
        rowStates[transformationId] = open;
        sessionStorage.setItem(fullStorageKey, JSON.stringify(rowStates));
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Failed to persist transformation state for ${transformationId}:`, error);
        }
        // Silently fail in production if storage unavailable or quota exceeded
      }
    },
    [fullStorageKey]
  );

  return { isOpen, setIsOpen };
}
