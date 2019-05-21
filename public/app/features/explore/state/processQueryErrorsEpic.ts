import { Epic } from 'redux-observable';
import { mergeMap } from 'rxjs/operators';
import { NEVER, of } from 'rxjs';
import { DataQueryError } from '@grafana/ui/src/types/datasource';

import { ActionOf, actionCreatorFactory } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { ExploreId, ResultType } from 'app/types/explore';
import { instanceOfDataQueryError } from 'app/core/utils/explore';
import { toDataQueryError } from 'app/features/dashboard/state/PanelQueryState';

export interface ProcessQueryErrorsPayload {
  exploreId: ExploreId;
  response: any;
  resultType: ResultType;
  datasourceId: string;
}

export interface QueryFailurePayload {
  exploreId: ExploreId;
  response: DataQueryError;
  resultType: ResultType;
}

export const processQueryErrorsAction = actionCreatorFactory<ProcessQueryErrorsPayload>(
  'explore/PROCESS_QUERY_ERRORS'
).create();

export const queryFailureAction = actionCreatorFactory<QueryFailurePayload>('explore/QUERY_FAILURE').create();

export const processQueryErrorsEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(processQueryErrorsAction.type).pipe(
    mergeMap((action: ActionOf<ProcessQueryErrorsPayload>) => {
      const { exploreId, datasourceId, resultType } = action.payload;
      let { response } = action.payload;
      const { datasourceInstance } = state$.value.explore[exploreId];

      if (datasourceInstance.meta.id !== datasourceId || response.cancelled) {
        // Navigated away, queries did not matter
        return NEVER;
      }

      console.error(response); // To help finding problems with query syntax

      if (!instanceOfDataQueryError(response)) {
        response = toDataQueryError(response);
      }

      return of(
        queryFailureAction({
          exploreId,
          response,
          resultType,
        })
      );
    })
  );
};
