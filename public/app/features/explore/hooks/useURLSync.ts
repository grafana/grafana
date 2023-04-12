import { useEffect } from 'react';

import { serializeStateToUrlParam } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { addListener, useDispatch } from 'app/types';

import { getUrlStateFromPaneState } from './utils';

/**
 * Syncs the URL with the state of the Explore panes by attaching a listener to the store and uptading
 * the URL on every state change (throttled).
 */
export function useURLSync() {
  const dispatch = useDispatch();

  // @ts-expect-error the return type of addListener is actually callable, but dispatch is not middleware-aware
  useEffect(() => {
    const unsubscribe = dispatch(
      addListener({
        predicate: (action) => action.type.startsWith('explore'),
        effect: async (_, { cancelActiveListeners, delay, getState }) => {
          cancelActiveListeners();
          // TODO: this is a magic number, maybe we can check instead if there are no pending actions?
          await delay(200);
          const { left, right } = getState().explore.panes;
          const orgId = getState().user.orgId.toString();
          const urlStates: { [index: string]: string | null } = { orgId };

          if (left) {
            urlStates.left = serializeStateToUrlParam(getUrlStateFromPaneState(left));
          }

          if (right) {
            urlStates.right = serializeStateToUrlParam(getUrlStateFromPaneState(right));
          } else {
            urlStates.right = null;
          }

          if (
            locationService.getSearch().get('right') !== urlStates.right ||
            locationService.getSearch().get('left') !== urlStates.left
          ) {
            // If there's no state in the URL it means we are mounting explore for the first time.
            // In that case we want to replace the URL instead of pushing a new entry to the history.
            const replace = !locationService.getSearch().has('right') && !locationService.getSearch().has('left');

            locationService.partial({ ...urlStates }, replace);
          }
        },
      })
    );

    return unsubscribe;
  }, [dispatch]);
}
