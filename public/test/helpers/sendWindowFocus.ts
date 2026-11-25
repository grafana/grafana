import { setupListeners } from '@reduxjs/toolkit/query';

import { dispatch } from 'app/store/store';

/**
 * Tells the app's store that the window regained focus, which refetches the queries that ask for it. RTK listens
 * to the window for the first store of a test file only, so a later store is sent the focus directly.
 */
export function sendWindowFocus() {
  setupListeners(dispatch, (send, { onFocus }) => {
    send(onFocus());
    return () => {};
  });
}
