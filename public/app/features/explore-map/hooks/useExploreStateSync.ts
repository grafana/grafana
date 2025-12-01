/**
 * Hook to synchronize Explore pane state changes to CRDT
 *
 * This hook watches for changes to the Explore pane (queries, datasource, range, etc.)
 * and broadcasts them via CRDT operations so other users see the changes in real-time.
 */

import { useEffect, useRef } from 'react';

import { useDispatch, useSelector } from 'app/types/store';

import { savePanelExploreState } from '../state/crdtSlice';
import { SerializedExploreState } from '../state/types';

interface UseExploreStateSyncOptions {
  panelId: string;
  exploreId: string;
  enabled?: boolean;
}

/**
 * Debounce delay for syncing explore state changes
 * We don't want to broadcast every keystroke, so we wait a bit
 */
const SYNC_DELAY_MS = 1000;

export function useExploreStateSync(options: UseExploreStateSyncOptions) {
  const { panelId, exploreId, enabled = true } = options;
  const dispatch = useDispatch();

  // Get the explore pane state from Redux
  const explorePane = useSelector((state) => state.explore?.panes?.[exploreId]);

  // Track previous state to detect changes
  const previousStateRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !explorePane) {
      return;
    }

    // Serialize the current explore state
    const currentState: SerializedExploreState = {
      queries: explorePane.queries,
      datasourceUid: explorePane.datasourceInstance?.uid,
      range: explorePane.range,
      refreshInterval: explorePane.refreshInterval,
      panelsState: explorePane.panelsState,
      compact: explorePane.compact,
    };

    const currentStateStr = JSON.stringify(currentState);

    // Check if state has actually changed
    if (previousStateRef.current === currentStateStr) {
      return;
    }

    console.log('[ExploreSync] Explore state changed for panel', panelId, currentState);
    previousStateRef.current = currentStateStr;

    // Clear any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce the sync operation
    syncTimeoutRef.current = setTimeout(() => {
      console.log('[ExploreSync] Dispatching savePanelExploreState for panel', panelId);
      dispatch(savePanelExploreState({
        panelId,
        exploreState: currentState,
      }));
    }, SYNC_DELAY_MS);

    // Cleanup timeout on unmount
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    panelId,
    // Intentionally not including explorePane to avoid excessive re-renders
    // We check previousStateRef inside the effect to detect actual changes
    dispatch,
  ]);
}
