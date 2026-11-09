import { useEffect } from 'react';

import { type SaveDashboardDrawer } from './SaveDashboardDrawer';

/**
 * Parks what a save form shows on the drawer as it changes, not on unmount: React renders the form
 * that takes over before this one's cleanup runs, so an unmount write would reach it one swap too late.
 * It merges, so a form without a Copy tags switch keeps the value another form parked.
 */
export function useParkSaveFormDraft(
  drawer: SaveDashboardDrawer,
  title: string,
  description: string,
  copyTags?: boolean
) {
  useEffect(() => {
    drawer.saveFormDraft = {
      ...drawer.saveFormDraft,
      title,
      description,
      ...(copyTags !== undefined && { copyTags }),
    };
  }, [drawer, title, description, copyTags]);
}
