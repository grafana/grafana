import { useEffect } from 'react';

import { serializeStateToUrlParam } from '@grafana/data';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { addListener, useDispatch } from 'app/types';

import { splitClose, splitOpen } from '../state/main';
import { commitQueries, runQueries } from '../state/query';
import { changeRangeAction } from '../state/time';

import { getUrlStateFromPaneState } from './utils';

/**
 * Syncs the URL with the state of the Explore panes by attaching a listener to the store and uptading
 * the URL on select state change.
 */
export function useURLSync() {
  const dispatch = useDispatch();
  const { location } = useGrafana();

  // @ts-expect-error the return type of addListener is actually callable, but dispatch is not middleware-aware
  useEffect(() => {
    const unsubscribe = dispatch(
      addListener({
        predicate: (action) =>
          // We want to update the URL when:
          [
            // - a pane is opened or closed
            splitClose.type,
            splitOpen.fulfilled.type,
            // - a query is run
            runQueries.pending.type,
            // - range is changed
            changeRangeAction.type,
            // - queries are committed
            commitQueries.type,
          ].includes(action.type),
        effect: async (_, { cancelActiveListeners, delay, getState }) => {
          // The following 2 lines will throttle the URL updates to 200ms.
          // This is because we don't want to update the URL multiple when for instance multiple
          // panes trigger a query run at the same time or when queries are executed in very rapid succession.
          cancelActiveListeners();
          await delay(200);

          const { left, right } = getState().explore.panes;
          const orgId = getState().user.orgId.toString();
          const panesState: { [index: string]: string | null } = { orgId };

          if (left) {
            panesState.left = serializeStateToUrlParam(getUrlStateFromPaneState(left));
          }

          if (right) {
            panesState.right = serializeStateToUrlParam(getUrlStateFromPaneState(right));
          } else {
            panesState.right = null;
          }

          if (
            location.getSearch().get('right') !== panesState.right ||
            location.getSearch().get('left') !== panesState.left
          ) {
            // If there's no state in the URL it means we are mounting explore for the first time.
            // In that case we want to replace the URL instead of pushing a new entry to the history.
            const replace = !location.getSearch().has('right') && !location.getSearch().has('left');

            location.partial({ ...panesState }, replace);
          }
        },
      })
    );

    return unsubscribe;
  }, [dispatch, location]);
}
