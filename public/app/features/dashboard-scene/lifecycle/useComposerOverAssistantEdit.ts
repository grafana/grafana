import { useEffect } from 'react';

import { useAssistantComposerEntry } from '../composer/useAssistantComposerEntry';

import { takeComposerRequestOverAssistantEdit } from './pendingChangesSave';

/**
 * Asks the Assistant to enter Composer over the edit Grafana opened for it on this dashboard, once: as the mode
 * picker does, opening the Assistant sidebar when it is closed so a listener can register. Waits until the sidebar
 * knows the Assistant's component, which a fresh load learns only after the page shows.
 */
export function useComposerOverAssistantEdit(uid: string | undefined) {
  const entry = useAssistantComposerEntry('dashboard');
  useEffect(() => {
    if (entry && uid && takeComposerRequestOverAssistantEdit(uid)) {
      entry.request({ resource: 'dashboard', uid }, { assistantEdit: true });
    }
  }, [entry, uid]);
}
