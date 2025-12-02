/**
 * Hook to sync panel explore state when panel is deselected
 *
 * This hook monitors panel selection changes and syncs the explore state
 * to CRDT when a panel is deselected, but only if the state has changed.
 */

import { useEffect, useRef } from 'react';
import { shallowEqual } from 'react-redux';

import { useDispatch, useSelector } from 'app/types/store';

import { savePanelExploreState } from '../state/crdtSlice';
import { selectSelectedPanelIds, selectPanels } from '../state/selectors';
import { SerializedExploreState } from '../state/types';

export interface UsePanelStateSyncOptions {
  panelId: string;
  exploreId: string;
}

/**
 * Hook to sync panel explore state when it's deselected
 */
export function usePanelStateSync({ panelId, exploreId }: UsePanelStateSyncOptions) {
  const dispatch = useDispatch();

  // Track if this panel was previously selected
  const wasSelectedRef = useRef(false);

  // Track the last synced state
  const lastSyncedStateRef = useRef<string | null>(null);

  // Get current selection state - memoized to only change when THIS panel's selection changes
  const isSelected = useSelector((state) => {
    const selectedIds = selectSelectedPanelIds(state.exploreMapCRDT);
    return selectedIds.includes(panelId);
  });

  // Get current explore state - using shallowEqual to prevent re-renders when content is the same
  const explorePane = useSelector((state) => state.explore?.panes?.[exploreId], shallowEqual);

  // Get the panel's saved exploreState only - using shallowEqual to prevent re-renders
  const panelExploreState = useSelector((state) => {
    const panels = selectPanels(state.exploreMapCRDT);
    return panels[panelId]?.exploreState;
  }, shallowEqual);

  useEffect((): void | (() => void) => {
    // Update tracking ref
    const previouslySelected = wasSelectedRef.current;
    wasSelectedRef.current = isSelected;

    // Detect deselection (was selected, now not selected)
    if (previouslySelected && !isSelected) {
      // Add a small delay to ensure explore state updates have been committed to Redux
      const syncTimer = setTimeout(() => {
        // Get current explore state (after delay to ensure it's updated)
        if (!explorePane) {
          return;
        }

        // Extract the key fields we care about
        const currentState: SerializedExploreState = {
          queries: explorePane.queries || [],
          datasourceUid: explorePane.datasourceInstance?.uid,
          range: explorePane.range,
          refreshInterval: explorePane.refreshInterval,
          panelsState: explorePane.panelsState,
          compact: explorePane.compact,
        };

        // Create a stable string representation focusing on the important fields
        const currentStateStr = JSON.stringify({
          datasourceUid: currentState.datasourceUid,
          queries: currentState.queries,
          range: currentState.range,
        });

        // Check if state has changed since last sync
        const hasChanged = lastSyncedStateRef.current !== currentStateStr;

        if (hasChanged) {
          // Dispatch sync action with full state
          dispatch(savePanelExploreState({
            panelId,
            exploreState: currentState,
          }));

          // Update last synced state
          lastSyncedStateRef.current = currentStateStr;
        }
      }, 100); // Small delay to ensure state is updated

      // Return cleanup function
      return () => clearTimeout(syncTimer);
    }
  }, [isSelected, panelId, exploreId, explorePane, dispatch]);

  // Initialize last synced state from panel's saved state
  useEffect(() => {
    if (panelExploreState && lastSyncedStateRef.current === null) {
      // Use the same format as in the main effect for consistency
      const initStateStr = JSON.stringify({
        datasourceUid: panelExploreState.datasourceUid,
        queries: panelExploreState.queries || [],
        range: panelExploreState.range,
      });
      lastSyncedStateRef.current = initStateStr;
    }
  }, [panelExploreState]);
}
