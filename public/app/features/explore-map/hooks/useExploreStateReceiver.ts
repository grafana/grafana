/**
 * Hook to receive and apply Explore state changes from CRDT
 *
 * This hook watches for CRDT operations that update panel explore state
 * and applies them to the local Explore pane so the user sees changes
 * made by other collaborators in real-time.
 */

import { useEffect, useRef } from 'react';

import { useDispatch, useSelector } from 'app/types/store';

import { changeDatasource } from '../../explore/state/datasource';
import { setQueriesAction } from '../../explore/state/query';
import { updateTime } from '../../explore/state/time';

interface UseExploreStateReceiverOptions {
  panelId: string;
  exploreId: string;
  enabled?: boolean;
}

/**
 * Hook to receive and apply explore state changes from CRDT
 */
export function useExploreStateReceiver(options: UseExploreStateReceiverOptions) {
  const { panelId, exploreId, enabled = true } = options;
  const dispatch = useDispatch();

  // Get the panel's explore state from CRDT
  const panels = useSelector((state) => {
    const crdtStateJSON = state.exploreMapCRDT.crdtStateJSON;
    if (!crdtStateJSON) {
      return {};
    }
    const parsed = JSON.parse(crdtStateJSON);
    const panelData: Record<string, { exploreState?: { value: any } }> = {};
    for (const [id, data] of Object.entries(parsed.panelData || {})) {
      panelData[id] = data as { exploreState?: { value: any } };
    }
    return panelData;
  });

  const panel = panels[panelId];
  const exploreState = panel?.exploreState?.value;

  // Get current Explore pane state for comparison
  const explorePane = useSelector((state) => state.explore?.panes?.[exploreId]);

  // Track what we've already applied to avoid loops
  const lastAppliedStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !exploreState || !explorePane) {
      return;
    }

    const exploreStateStr = JSON.stringify(exploreState);

    // Skip if we've already applied this exact state
    if (lastAppliedStateRef.current === exploreStateStr) {
      return;
    }

    lastAppliedStateRef.current = exploreStateStr;

    // Apply queries if they've changed
    if (exploreState.queries && JSON.stringify(exploreState.queries) !== JSON.stringify(explorePane.queries)) {
      dispatch(setQueriesAction({
        exploreId,
        queries: exploreState.queries,
      }));
    }

    // Apply datasource if it's changed
    if (exploreState.datasourceUid && exploreState.datasourceUid !== explorePane.datasourceInstance?.uid) {
      dispatch(changeDatasource({
        exploreId,
        datasource: exploreState.datasourceUid,
      }));
    }

    // Apply time range if it's changed
    if (exploreState.range && JSON.stringify(exploreState.range) !== JSON.stringify(explorePane.range)) {
      // If range.raw exists, use it (for properly structured TimeRange objects)
      // Otherwise, treat the range itself as a RawTimeRange (for backward compatibility)
      const rawRange = (exploreState.range as any).raw || exploreState.range;
      dispatch(updateTime({
        exploreId,
        rawRange: rawRange,
      }));
    }

    // Note: We don't sync refreshInterval, panelsState, or compact mode automatically
    // as those are more UI preference than data state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    panelId,
    exploreId,
    // Intentionally not including exploreState or explorePane to avoid excessive re-renders
    // We use refs inside the effect to detect actual changes
    dispatch,
  ]);
}
