import { useCallback, useEffect, useRef, useState } from 'react';

import { store } from '@grafana/data';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { useDispatch, useSelector } from 'app/types/store';

import { exploreMapApi } from '../api/exploreMapApi';
import { loadCanvas } from '../state/exploreMapSlice';
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
  const exploreState = useSelector((state) => state.explore);
  const [loading, setLoading] = useState(!!uid);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

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
          const parsed: ExploreMapState = JSON.parse(mapData.data);
          // Use title from DB column, not from JSON data
          parsed.uid = mapData.uid;
          parsed.title = mapData.title;
          dispatch(loadCanvas(parsed));
        } catch (error) {
          console.error('Failed to load map from API:', error);
          dispatch(
            notifyApp(
              createErrorNotification('Failed to load explore map', 'The map may not exist or you may not have access')
            )
          );
          // Redirect to list page after a delay
          setTimeout(() => {
            window.location.href = '/explore-maps';
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
            dispatch(loadCanvas(parsed));
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
    // Don't persist an empty canvas; this avoids removing a previously saved
    // non-empty canvas when the in-memory state is still at its initial value.
    if (!exploreMapState || Object.keys(exploreMapState.panels || {}).length === 0) {
      return;
    }

    // Skip auto-save during initial load
    if (!initialLoadDone.current || loading) {
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const saveState = async () => {
      const enrichedState = enrichStateWithExploreData(exploreMapState);

      if (uid) {
        // Save to API with debounce
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            setSaving(true);
            const titleToSave = exploreMapState.title || 'Untitled Map';
            // Ensure data also has the correct title
            const dataToSave = {
              ...enrichedState,
              uid: exploreMapState.uid,
              title: titleToSave,
            };
            await exploreMapApi.updateExploreMap(uid, {
              title: titleToSave,
              data: dataToSave,
            });
            setLastSaved(new Date());
          } catch (error) {
            console.error('Failed to save map to API:', error);
            dispatch(notifyApp(createErrorNotification('Failed to save explore map', 'Changes may not be persisted')));
          } finally {
            setSaving(false);
          }
        }, AUTO_SAVE_DELAY_MS);
      } else {
        // Save to localStorage immediately (legacy mode)
        try {
          store.set(STORAGE_KEY, JSON.stringify(enrichedState));
        } catch (error) {
          console.error('Failed to save canvas state to storage:', error);
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
  }, [exploreMapState, exploreState, enrichStateWithExploreData, dispatch, loading, uid]);

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
            dispatch(loadCanvas(parsed));
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
