import { useCallback, useState } from 'react';

import { QueryOptionField } from '../types';

export interface UseQueryEditorUITogglesResult {
  isQueryOptionsOpen: boolean;
  focusedField: QueryOptionField | null;
  showingDatasourceHelp: boolean;
  transformTogglesState: { showHelp: boolean; showDebug: boolean };
  openSidebar: (focusField?: QueryOptionField) => void;
  closeSidebar: () => void;
  /** Resets datasource help and transform help/debug toggles to their default (hidden) state. */
  resetUIToggles: () => void;
  toggleDatasourceHelp: () => void;
  toggleHelp: () => void;
  toggleDebug: () => void;
}

/**
 * Manages UI-only toggle state for the query editor:
 * the query options sidebar, datasource help panel, and transformation debug/help toggles.
 *
 * These have no dependency on Scene objects and can be tested in complete isolation.
 */
export function useQueryEditorUIToggles(): UseQueryEditorUITogglesResult {
  const [isQueryOptionsOpen, setIsQueryOptionsOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<QueryOptionField | null>(null);
  const [showingDatasourceHelp, setShowingDatasourceHelp] = useState(false);
  const [transformTogglesState, setTransformTogglesState] = useState({
    showHelp: false,
    showDebug: false,
  });

  const openSidebar = useCallback((focusField?: QueryOptionField) => {
    setIsQueryOptionsOpen(true);
    if (focusField) {
      setFocusedField(focusField);
    }
  }, []);

  const closeSidebar = useCallback(() => {
    setIsQueryOptionsOpen(false);
    setFocusedField(null);
  }, []);

  const resetUIToggles = useCallback(() => {
    setShowingDatasourceHelp(false);
    setTransformTogglesState({ showHelp: false, showDebug: false });
  }, []);

  const toggleDatasourceHelp = useCallback(() => {
    setShowingDatasourceHelp((prev) => !prev);
  }, []);

  const toggleHelp = useCallback(() => {
    setTransformTogglesState((prev) => ({ ...prev, showHelp: !prev.showHelp }));
  }, []);

  const toggleDebug = useCallback(() => {
    setTransformTogglesState((prev) => ({ ...prev, showDebug: !prev.showDebug }));
  }, []);

  return {
    isQueryOptionsOpen,
    focusedField,
    showingDatasourceHelp,
    transformTogglesState,
    openSidebar,
    closeSidebar,
    resetUIToggles,
    toggleDatasourceHelp,
    toggleHelp,
    toggleDebug,
  };
}
