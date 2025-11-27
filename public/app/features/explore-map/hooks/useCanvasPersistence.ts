import { useEffect } from 'react';

import { useDispatch, useSelector } from 'app/types/store';

import { loadCanvas } from '../state/exploreMapSlice';
import { ExploreMapState } from '../state/types';

const STORAGE_KEY = 'grafana.exploreMap.state';

export function useCanvasPersistence() {
  const dispatch = useDispatch();
  const exploreMapState = useSelector((state) => state.exploreMap);

  // Load state from localStorage on mount
  // Note: Explore state is not persisted here - each panel will re-initialize
  // its Explore instance when ExploreMapPanelContent mounts
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed: ExploreMapState = JSON.parse(savedState);
        dispatch(loadCanvas(parsed));
      }
    } catch (error) {
      console.error('Failed to load canvas state from localStorage:', error);
    }
  }, [dispatch]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(exploreMapState));
    } catch (error) {
      console.error('Failed to save canvas state to localStorage:', error);
    }
  }, [exploreMapState]);

  const exportCanvas = () => {
    try {
      const dataStr = JSON.stringify(exploreMapState, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `explore-map-${new Date().toISOString()}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Failed to export canvas:', error);
      alert('Failed to export canvas. Check console for details.');
    }
  };

  const importCanvas = () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const parsed: ExploreMapState = JSON.parse(content);
            dispatch(loadCanvas(parsed));
            alert('Canvas imported successfully!');
          } catch (error) {
            console.error('Failed to parse imported canvas:', error);
            alert('Failed to import canvas. Invalid file format.');
          }
        };
        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      console.error('Failed to import canvas:', error);
      alert('Failed to import canvas. Check console for details.');
    }
  };

  return {
    exportCanvas,
    importCanvas,
  };
}
