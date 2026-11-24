import { useEffect } from 'react';

import { useAssistantComposerEntry } from '../composer/useAssistantComposerEntry';

import { takeComposerRequestOverAssistantEdit } from './pendingChangesSave';

/**
 * Asks the Assistant to enter Composer over the edit Grafana opened for it on this dashboard, once: as the mode
 * picker does, opening the Assistant sidebar when it is closed so a listener can register. Waits until the sidebar
 * knows the Assistant's component, which a fresh load learns only after the page shows. If the user has left
 * Editing by then, the request is dropped rather than made over Viewing.
 */
export function useComposerOverAssistantEdit(uid: string | undefined, isEditing: boolean) {
  const entry = useAssistantComposerEntry('dashboard');
  useEffect(() => {
    // Take the request whenever it can be made, so one the user left Editing before is not made later.
    if (entry && uid && takeComposerRequestOverAssistantEdit(uid) && isEditing) {
      entry.request({ resource: 'dashboard', uid }, { assistantEdit: true });
    }
  }, [entry, uid, isEditing]);
}

/** Makes the request from the dashboard page. Rendered only with Composer on, so the page is untouched without it. */
export function ComposerOverAssistantEdit({ uid, isEditing }: { uid: string | undefined; isEditing: boolean }) {
  useComposerOverAssistantEdit(uid, isEditing);
  return null;
}
