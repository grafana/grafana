import { useCallback, useEffect, useRef, useState } from 'react';

import { store } from '@grafana/data';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { useDispatch, useSelector } from 'app/types/store';

import { exploreMapApi } from '../api/exploreMapApi';
import { initializeFromLegacyState, loadState as loadCRDTState } from '../state/crdtSlice';
import { loadCanvas } from '../state/exploreMapSlice';
import { selectPanels, selectFrames, selectMapTitle, selectViewport } from '../state/selectors';
import { ExploreMapState, initialExploreMapState, SerializedExploreState } from '../state/types';

const STORAGE_KEY = 'grafana.exploreMap.state';
const AUTO_SAVE_DELAY_MS = 2000;

interface UseMapPersistenceOptions {
  uid?: string; // If provided, load from and save to API. If not, use localStorage (legacy mode)
}

export function useCanvasPersistence(options: UseMapPersistenceOptions = {}) {
  const { uid } = options;
  const dispatch = useDispatch();
  const exploreMapState = useSelector((state) => state.exploreMap);
  const crdtState = useSelector((state) => state.exploreMapCRDT);
  const exploreState = useSelector((state) => state.explore);
  const [loading, setLoading] = useState(!!uid);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);
  const lastSavedCRDTStateRef = useRef<string | null | undefined>(null);

  // Helper to enrich state with Explore pane data
  const enrichStateWithExploreData = useCallback(
    (state: ExploreMapState): ExploreMapState => {
      return {
        ...state,
        selectedPanelIds: [], // Don't persist selection state
        cursors: {}, // Don't persist cursor state - it's ephemeral
        panels: Object.fromEntries(
          Object.entries(state.panels).map(([panelId, panel]) => {
            const explorePane = exploreState.panes?.[panel.exploreId];

            let exploreStateToSave: SerializedExploreState | undefined = undefined;
            if (explorePane) {
              exploreStateToSave = {
                queries: explorePane.queries,
                datasourceUid: explorePane.datasourceInstance?.uid,
                range: explorePane.range,
                refreshInterval: explorePane.refreshInterval,
                panelsState: explorePane.panelsState,
                compact: explorePane.compact,
              };
            }

            return [
              panelId,
              {
                ...panel,
                exploreState: exploreStateToSave,
              },
            ];
          })
        ),
      };
    },
    [exploreState]
  );

  // Load state on mount
  useEffect(() => {
    if (initialLoadDone.current) {
      return;
    }
    initialLoadDone.current = true;

    const loadState = async () => {
      if (uid) {
        // Load from API
        try {
          setLoading(true);
          const mapData = await exploreMapApi.getExploreMap(uid);

          // Handle empty or missing data (new maps)
          let parsed: ExploreMapState;
          if (!mapData.data || mapData.data.trim() === '') {
            // Initialize with default empty state for new maps
            parsed = {
              ...initialExploreMapState,
              uid: mapData.uid,
              title: mapData.title,
            };
          } else {
            parsed = JSON.parse(mapData.data);
            // Use title from DB column, not from JSON data
            parsed.uid = mapData.uid;
            parsed.title = mapData.title;
          }

          // Load into legacy state (for backward compatibility)
          dispatch(loadCanvas(parsed));

          // Initialize CRDT state from loaded data
          // If CRDT state is available, use it directly. Otherwise, initialize from legacy panels.
          if (parsed.crdtState) {
            // Load the saved CRDT state which includes proper OR-Set metadata
            dispatch(loadCRDTState({ crdtState: parsed.crdtState }));
          } else {
            // Fallback to legacy initialization for backward compatibility
            dispatch(initializeFromLegacyState({
              uid: parsed.uid,
              title: parsed.title,
              panels: parsed.panels || {},
              viewport: parsed.viewport || initialExploreMapState.viewport,
            }));
          }
        } catch (error) {
          console.error('Failed to load map from API:', error);
          dispatch(
            notifyApp(
              createErrorNotification('Failed to load atlas', 'The map may not exist or you may not have access')
            )
          );
          // Redirect to list page after a delay
          setTimeout(() => {
            window.location.href = '/atlas';
          }, 2000);
        } finally {
          setLoading(false);
        }
      } else {
        // Load from localStorage (legacy mode)
        try {
          const savedState = store.get(STORAGE_KEY);
          if (savedState) {
            const parsed: ExploreMapState = JSON.parse(savedState);

            // Load into legacy state
            dispatch(loadCanvas(parsed));

            // Initialize CRDT state from loaded data
            // If CRDT state is available, use it directly. Otherwise, initialize from legacy panels.
            if (parsed.crdtState) {
              // Load the saved CRDT state which includes proper OR-Set metadata
              dispatch(loadCRDTState({ crdtState: parsed.crdtState }));
            } else {
              // Fallback to legacy initialization for backward compatibility
              dispatch(initializeFromLegacyState({
                uid: parsed.uid,
                title: parsed.title,
                panels: parsed.panels,
                viewport: parsed.viewport,
              }));
            }
          }
        } catch (error) {
          console.error('Failed to load canvas state from storage:', error);
        }
      }
    };

    loadState();
  }, [dispatch, uid]);

  // Auto-save to API or localStorage
  useEffect(() => {
    // Skip auto-save during initial load
    if (!initialLoadDone.current || loading) {
      return;
    }

    // Get current CRDT state as panels
    const panels = selectPanels(crdtState);
    const frames = selectFrames(crdtState);
    const mapTitle = selectMapTitle(crdtState);
    const viewport = selectViewport(crdtState);

    // Don't persist an empty canvas; this avoids removing a previously saved
    // non-empty canvas when the in-memory state is still at its initial value.
    // Allow saving if there are either panels or frames
    if (Object.keys(panels || {}).length === 0 && Object.keys(frames || {}).length === 0) {
      return;
    }

    // Check if CRDT state has actually changed (ignore local UI state like selection)
    const currentCRDTStateStr = crdtState.crdtStateJSON;
    if (currentCRDTStateStr === lastSavedCRDTStateRef.current) {
      // No changes to persist
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const saveState = async () => {
      // CRDT panels already contain exploreState from savePanelExploreState actions
      // We don't need to enrich them with live Explore pane data

      // Save both legacy format (for backward compat) and CRDT state
      const enrichedState: ExploreMapState = {
        uid,
        title: mapTitle,
        viewport,
        panels: panels, // Already contains exploreState from CRDT
        frames: frames, // Frames from CRDT state
        selectedPanelIds: [],
        nextZIndex: 1,
        cursors: {},
        cursorMode: 'pointer',
        // Store the raw CRDT state for proper sync across sessions
        crdtState: crdtState.crdtStateJSON ? JSON.parse(crdtState.crdtStateJSON) : undefined,
      };

      if (uid) {
        // Save to API with debounce
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            setSaving(true);
            const titleToSave = mapTitle || 'Untitled Map';
            const dataToSave = enrichedState;
            await exploreMapApi.updateExploreMap(uid, {
              title: titleToSave,
              data: dataToSave,
            });
            setLastSaved(new Date());
            // Update last saved state ref to prevent duplicate saves
            lastSavedCRDTStateRef.current = currentCRDTStateStr;
          } catch (error) {
            dispatch(notifyApp(createErrorNotification('Failed to save atlas', 'Changes may not be persisted')));
          } finally {
            setSaving(false);
          }
        }, AUTO_SAVE_DELAY_MS);
      } else {
        // Save to localStorage immediately (legacy mode)
        try {
          store.set(STORAGE_KEY, JSON.stringify(enrichedState));
          // Update last saved state ref to prevent duplicate saves
          lastSavedCRDTStateRef.current = currentCRDTStateStr;
        } catch (error) {
        }
      }
    };

    saveState();

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [crdtState, dispatch, loading, uid]);

  const exportCanvas = useCallback(() => {
    try {
      // Enrich with Explore state before exporting
      const enrichedState = enrichStateWithExploreData({
        ...exploreMapState,
        viewport: initialExploreMapState.viewport, // Don't export viewport state - use initial centered viewport
      });

      const dataStr = JSON.stringify(enrichedState, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `explore-map-${new Date().toISOString()}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      dispatch(notifyApp(createSuccessNotification('Canvas exported successfully')));
    } catch (error) {
      console.error('Failed to export canvas:', error);
      dispatch(notifyApp(createErrorNotification('Failed to export canvas', 'Check console for details')));
    }
  }, [dispatch, enrichStateWithExploreData, exploreMapState]);

  const importCanvas = useCallback(() => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.onchange = (e: Event) => {
        if (!(e.target instanceof HTMLInputElement)) {
          return;
        }
        const file = e.target.files?.[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const result = event.target?.result;
            if (typeof result !== 'string') {
              throw new Error('Invalid file content');
            }
            const parsed: ExploreMapState = JSON.parse(result);

            // Load into legacy state
            dispatch(loadCanvas(parsed));

            // Initialize CRDT state from imported data
            // If CRDT state is available, use it directly. Otherwise, initialize from legacy panels.
            if (parsed.crdtState) {
              // Load the saved CRDT state which includes proper OR-Set metadata
              dispatch(loadCRDTState({ crdtState: parsed.crdtState }));
            } else {
              // Fallback to legacy initialization for backward compatibility
              dispatch(initializeFromLegacyState({
                uid: parsed.uid,
                title: parsed.title,
                panels: parsed.panels,
                viewport: parsed.viewport,
              }));
            }

            dispatch(notifyApp(createSuccessNotification('Canvas imported successfully')));
          } catch (error) {
            console.error('Failed to parse imported canvas:', error);
            dispatch(notifyApp(createErrorNotification('Failed to import canvas', 'Invalid file format')));
          }
        };
        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      console.error('Failed to import canvas:', error);
      dispatch(notifyApp(createErrorNotification('Failed to import canvas', 'Check console for details')));
    }
  }, [dispatch]);

  return {
    loading,
    saving,
    lastSaved,
    exportCanvas,
    importCanvas,
  };
}
