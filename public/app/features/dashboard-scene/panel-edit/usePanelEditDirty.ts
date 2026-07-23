import { useEffect, useState } from 'react';

import { type PanelEditor } from './PanelEditor';

/**
 * Bridges PanelEditor's isDirty scene state into React state. Accepts undefined so consumers can
 * call it unconditionally while panel edit may not be active. Deliberately starts undefined and
 * only tracks changes made after mount, so editor-initialization state churn doesn't count as
 * dirty.
 */
export function usePanelEditDirty(panelEditor?: PanelEditor) {
  const [isDirty, setIsDirty] = useState<boolean | undefined>();

  // isDirty lives in scene state outside React, so we have to subscribe to changes.
  useEffect(() => {
    if (!panelEditor) {
      return;
    }

    const sub = panelEditor.subscribeToState(({ isDirty }) => setIsDirty(isDirty));

    return () => sub.unsubscribe();
  }, [panelEditor]);

  return isDirty;
}
