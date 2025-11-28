import { useEffect } from 'react';

import { store } from '@grafana/data';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { useDispatch, useSelector } from 'app/types/store';

import { loadCanvas } from '../state/exploreMapSlice';
import { ExploreMapState, SerializedExploreState } from '../state/types';

const STORAGE_KEY = 'grafana.exploreMap.state';

export function useCanvasPersistence() {
  const dispatch = useDispatch();
  const exploreMapState = useSelector((state) => state.exploreMap);
  const exploreState = useSelector((state) => state.explore);

  // Load state from storage on mount
  useEffect(() => {
    try {
      const savedState = store.get(STORAGE_KEY);
      if (savedState) {
        const parsed: ExploreMapState = JSON.parse(savedState);
        dispatch(loadCanvas(parsed));
      }
    } catch (error) {
      console.error('Failed to load canvas state from storage:', error);
    }
  }, [dispatch]);

  // Save state to storage whenever it changes, including Explore state
  useEffect(() => {
    try {
      // Enrich exploreMapState with current Explore state for each panel
      const enrichedState: ExploreMapState = {
        ...exploreMapState,
        cursors: {}, // Don't persist cursor state - it's ephemeral
        panels: Object.fromEntries(
          Object.entries(exploreMapState.panels).map(([panelId, panel]) => {
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

      store.set(STORAGE_KEY, JSON.stringify(enrichedState));
    } catch (error) {
      console.error('Failed to save canvas state to storage:', error);
    }
  }, [exploreMapState, exploreState]);

  const exportCanvas = () => {
    try {
      // Enrich with Explore state before exporting
      const enrichedState: ExploreMapState = {
        ...exploreMapState,
        cursors: {}, // Don't export cursor state - it's ephemeral
        panels: Object.fromEntries(
          Object.entries(exploreMapState.panels).map(([panelId, panel]) => {
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
      dispatch(
        notifyApp(createErrorNotification('Failed to export canvas', 'Check console for details'))
      );
    }
  };

  const importCanvas = () => {
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
            dispatch(
              notifyApp(createErrorNotification('Failed to import canvas', 'Invalid file format'))
            );
          }
        };
        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      console.error('Failed to import canvas:', error);
      dispatch(
        notifyApp(createErrorNotification('Failed to import canvas', 'Check console for details'))
      );
    }
  };

  return {
    exportCanvas,
    importCanvas,
  };
}
