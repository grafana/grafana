/**
 * Hook to sync panel explore state when panel is deselected
 *
 * This hook monitors panel selection changes and syncs the explore state
 * to CRDT when a panel is deselected, but only if the state has changed.
 */

import { useEffect, useRef } from 'react';

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

  // Get current selection state
  const selectedPanelIds = useSelector((state) => selectSelectedPanelIds(state.exploreMapCRDT));
  const isSelected = selectedPanelIds.includes(panelId);

  // Get current explore state
  const explorePane = useSelector((state) => state.explore?.panes?.[exploreId]);

  // Get the panel's saved state
  const panels = useSelector((state) => selectPanels(state.exploreMapCRDT));
  const panel = panels[panelId];

  useEffect((): void | (() => void) => {
    // Update tracking ref
    const previouslySelected = wasSelectedRef.current;
    wasSelectedRef.current = isSelected;

    // Detect deselection (was selected, now not selected)
    if (previouslySelected && !isSelected) {
      console.log('[PanelStateSync] Panel deselected:', panelId);

      // Add a small delay to ensure explore state updates have been committed to Redux
      const syncTimer = setTimeout(() => {
        // Get current explore state (after delay to ensure it's updated)
        if (!explorePane) {
          console.log('[PanelStateSync] No explore pane found for', exploreId);
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

        // Log detailed info about queries and datasource
        console.log('[PanelStateSync] Current state:', {
          datasourceUid: currentState.datasourceUid,
          queriesCount: currentState.queries.length,
          queries: currentState.queries,
        });

        // Create a stable string representation focusing on the important fields
        const currentStateStr = JSON.stringify({
          datasourceUid: currentState.datasourceUid,
          queries: currentState.queries,
          range: currentState.range,
        });

        console.log('[PanelStateSync] Last synced state:', lastSyncedStateRef.current?.substring(0, 100));
        console.log('[PanelStateSync] Current state str:', currentStateStr.substring(0, 100));

        // Check if state has changed since last sync
        const hasChanged = lastSyncedStateRef.current !== currentStateStr;

        if (hasChanged) {
          console.log('[PanelStateSync] State changed, syncing full state');

          // Dispatch sync action with full state
          dispatch(savePanelExploreState({
            panelId,
            exploreState: currentState,
          }));

          // Update last synced state
          lastSyncedStateRef.current = currentStateStr;
        } else {
          console.log('[PanelStateSync] State unchanged, skipping sync');
        }
      }, 100); // Small delay to ensure state is updated

      // Return cleanup function
      return () => clearTimeout(syncTimer);
    }
  }, [isSelected, panelId, exploreId, explorePane, dispatch]);

  // Initialize last synced state from panel's saved state
  useEffect(() => {
    if (panel?.exploreState && lastSyncedStateRef.current === null) {
      // Use the same format as in the main effect for consistency
      const initStateStr = JSON.stringify({
        datasourceUid: panel.exploreState.datasourceUid,
        queries: panel.exploreState.queries || [],
        range: panel.exploreState.range,
      });
      lastSyncedStateRef.current = initStateStr;
      console.log('[PanelStateSync] Initialized with saved state:', initStateStr.substring(0, 100));
    }
  }, [panel?.exploreState]);
}
