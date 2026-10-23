import { useEffect } from 'react';

import { type SaveDashboardDrawer } from './SaveDashboardDrawer';

/**
 * Parks what a save form shows on the drawer as it changes, not on unmount: React renders the form
 * that takes over before this one's cleanup runs, so an unmount write would reach it one swap too late
 */
export function useParkSaveFormDraft(drawer: SaveDashboardDrawer, title: string, description: string) {
  useEffect(() => {
    drawer.saveFormDraft = { title, description };
  }, [drawer, title, description]);
}
