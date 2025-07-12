import { useEffect, useRef } from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';
import { useAppNotification } from 'app/core/copy/appNotification';
import { ExploreQueryParams } from 'app/types/explore';
import { addListener, useDispatch, useSelector } from 'app/types/store';

import { selectPanes } from '../../state/selectors';

import { parseURL } from './parseURL';
import { syncFromURL } from './synchronizer/fromURL';
import { initializeFromURL } from './synchronizer/init';
import { syncToURL, syncToURLPredicate } from './synchronizer/toURL';

export { getUrlStateFromPaneState } from './external.utils';

/**
 * Bi-directionally syncs URL changes with Explore's state.
 */
export function useStateSync(params: ExploreQueryParams) {
  const { location } = useGrafana();
  const dispatch = useDispatch();
  const panesState = useSelector(selectPanes);
  const panesStateRef = useRef(panesState);
  const orgId = useSelector((state) => state.user.orgId);
  const prevParams = useRef(params);
  const initState = useRef<'notstarted' | 'pending' | 'done'>('notstarted');
  const paused = useRef(false);
  const { warning } = useAppNotification();

  useEffect(() => {
    // This happens when the user navigates to an explore "empty page" while within Explore.
    // ie. by clicking on the explore when explore is active.
    if (!params.panes) {
      initState.current = 'notstarted';
      prevParams.current = params;
    }
  }, [params]);

  useEffect(() => {
    const unsubscribe = dispatch(
      addListener({
        predicate: (action) => syncToURLPredicate(paused, action),
        effect: async (_, { cancelActiveListeners, delay, getState }) => {
          // The following 2 lines will debounce updates to avoid creating history entries when rapid changes
          // are committed to the store.
          cancelActiveListeners();
          await delay(200);
          syncToURL(getState().explore, prevParams, initState, location);
        },
      })
    );

    // @ts-expect-error the return type of addListener is actually callable, but dispatch is not middleware-aware
    return () => unsubscribe();
  }, [dispatch, location]);

  useEffect(() => {
    panesStateRef.current = panesState;
  }, [panesState]);

  useEffect(() => {
    const isURLOutOfSync = prevParams.current?.panes !== params.panes;

    const [urlState, hasParseError] = parseURL(params);
    hasParseError &&
      warning(
        'Could not parse Explore URL',
        'The requested URL contains invalid parameters, a default Explore state has been loaded.'
      );

    // This happens when the user first navigates to explore.
    // Here we want to initialize each pane initial data, wether it comes
    // from the url or as a result of migrations.
    if (!isURLOutOfSync && initState.current === 'notstarted') {
      initState.current = 'pending';
      initializeFromURL(urlState, initState, orgId, dispatch, location);
    }

    prevParams.current = params;

    if (isURLOutOfSync && initState.current === 'done') {
      syncFromURL(urlState, panesStateRef.current, dispatch);
    }
  }, [dispatch, orgId, location, params, warning]);
}
