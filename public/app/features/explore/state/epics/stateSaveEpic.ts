import { Epic } from 'redux-observable';
import { mergeMap } from 'rxjs/operators';
import { RawTimeRange, TimeRange } from '@grafana/ui/src/types/time';
import { isDateTime } from '@grafana/ui/src/utils/moment_wrapper';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { ExploreUrlState, ExploreId } from 'app/types/explore';
import { clearQueryKeys, serializeStateToUrlParam } from 'app/core/utils/explore';
import { updateLocation } from 'app/core/actions/location';
import { setUrlReplacedAction, stateSaveAction } from '../actionTypes';

const toRawTimeRange = (range: TimeRange): RawTimeRange => {
  let from = range.raw.from;
  if (isDateTime(from)) {
    from = from.valueOf().toString(10);
  }

  let to = range.raw.to;
  if (isDateTime(to)) {
    to = to.valueOf().toString(10);
  }

  return {
    from,
    to,
  };
};

export const stateSaveEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(stateSaveAction.type).pipe(
    mergeMap(() => {
      const { left, right, split } = state$.value.explore;
      const replace = left && left.urlReplaced === false;
      const urlStates: { [index: string]: string } = {};
      const leftUrlState: ExploreUrlState = {
        datasource: left.datasourceInstance.name,
        queries: left.queries.map(clearQueryKeys),
        range: toRawTimeRange(left.range),
        mode: left.mode,
        ui: {
          showingGraph: left.showingGraph,
          showingLogs: true,
          showingTable: left.showingTable,
          dedupStrategy: left.dedupStrategy,
        },
      };
      urlStates.left = serializeStateToUrlParam(leftUrlState, true);
      if (split) {
        const rightUrlState: ExploreUrlState = {
          datasource: right.datasourceInstance.name,
          queries: right.queries.map(clearQueryKeys),
          range: toRawTimeRange(right.range),
          mode: right.mode,
          ui: {
            showingGraph: right.showingGraph,
            showingLogs: true,
            showingTable: right.showingTable,
            dedupStrategy: right.dedupStrategy,
          },
        };

        urlStates.right = serializeStateToUrlParam(rightUrlState, true);
      }

      const actions: Array<ActionOf<any>> = [updateLocation({ query: urlStates, replace })];
      if (replace) {
        actions.push(setUrlReplacedAction({ exploreId: ExploreId.left }));
      }

      return actions;
    })
  );
};
