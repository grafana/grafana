import { Action } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';
import { MutableRefObject } from 'react';

import { UrlQueryMap } from '@grafana/data';
import { LocationService } from '@grafana/runtime';
import { changeDatasource } from 'app/features/explore/state/datasource';
import { changePanelsStateAction } from 'app/features/explore/state/explorePane';
import { splitClose, splitOpen } from 'app/features/explore/state/main';
import { runQueries } from 'app/features/explore/state/query';
import { changeRangeAction } from 'app/features/explore/state/time';
import { ExploreState } from 'app/types/explore';

import { getUrlStateFromPaneState } from '../index';
import { InitState } from '../internal.utils';

/*
We want to update the URL when:
 - a pane is opened or closed
 - a query is run
 - range is changed
 - panel state is updated
 - a datasource change has completed.

Note: Changing datasource causes a bunch of actions to be dispatched, we want to update the URL
only when the change set has completed. This is done by checking if the changeDatasource.pending action
has been dispatched and pausing the listener until the changeDatasource.fulfilled action is dispatched.
*/
export function syncToURLPredicate(paused: MutableRefObject<boolean>, action: Action) {
  paused.current = changeDatasource.pending.type === action.type;

  return (
    [
      splitClose.type,
      splitOpen.fulfilled.type,
      runQueries.pending.type,
      changeRangeAction.type,
      changePanelsStateAction.type,
      changeDatasource.fulfilled.type,
    ].includes(action.type) && !paused.current
  );
}

export function syncToURL(
  exploreState: ExploreState,
  prevParams: MutableRefObject<UrlQueryMap>,
  initState: MutableRefObject<InitState>,
  location: LocationService
) {
  const panesQueryParams = Object.entries(exploreState.panes).reduce((acc, [id, paneState]) => {
    if (!paneState) {
      return acc;
    }
    return {
      ...acc,
      [id]: getUrlStateFromPaneState(paneState),
    };
  }, {});

  if (!isEqual(prevParams.current.panes, JSON.stringify(panesQueryParams))) {
    // If there's no previous state it means we are mounting explore for the first time,
    // in this case we want to replace the URL instead of pushing a new entry to the history.
    // If the init state is 'pending' it means explore still hasn't finished initializing. in that case we skip
    // pushing a new entry in the history as the first entry will be pushed after initialization.
    const replace =
      (!!prevParams.current.panes && Object.values(prevParams.current.panes).filter(Boolean).length === 0) ||
      initState.current === 'pending';

    prevParams.current = {
      panes: JSON.stringify(panesQueryParams),
    };

    location.partial({ panes: prevParams.current.panes }, replace);
  }
}
