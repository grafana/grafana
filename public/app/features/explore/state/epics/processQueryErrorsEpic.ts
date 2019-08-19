import { Epic } from 'redux-observable';
import { mergeMap } from 'rxjs/operators';
import { NEVER, of } from 'rxjs';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { instanceOfDataQueryError } from 'app/core/utils/explore';
import { toDataQueryError } from 'app/features/dashboard/state/PanelQueryState';
import { processQueryErrorsAction, ProcessQueryErrorsPayload, queryFailureAction } from '../actionTypes';

export const processQueryErrorsEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(processQueryErrorsAction.type).pipe(
    mergeMap((action: ActionOf<ProcessQueryErrorsPayload>) => {
      const { exploreId, datasourceId } = action.payload;
      let { response } = action.payload;
      const { datasourceInstance, eventBridge } = state$.value.explore[exploreId];

      if (datasourceInstance.meta.id !== datasourceId || response.cancelled) {
        // Navigated away, queries did not matter
        return NEVER;
      }

      // For Angular editors
      eventBridge.emit('data-error', response);

      console.error(response); // To help finding problems with query syntax

      if (!instanceOfDataQueryError(response)) {
        response = toDataQueryError(response);
      }

      return of(
        queryFailureAction({
          exploreId,
          response,
        })
      );
    })
  );
};
