import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from 'redux';

import { StoreState } from 'app/types/store';
import { toggleLogActions } from '../reducers/application';

export const toggleLogActionsMiddleware: Middleware<{}, StoreState> = (store: MiddlewareAPI<Dispatch, StoreState>) => (
  next: Dispatch
) => (action: AnyAction) => {
  const isLogActionsAction = action.type === toggleLogActions.type;
  if (isLogActionsAction) {
    return next(action);
  }

  const logActionsTrue =
    window && window.location && window.location.search && window.location.search.indexOf('logActions=true') !== -1;
  const logActionsFalse =
    window && window.location && window.location.search && window.location.search.indexOf('logActions=false') !== -1;
  const logActions = store.getState().application.logActions;

  if (logActionsTrue && !logActions) {
    store.dispatch(toggleLogActions());
  }

  if (logActionsFalse && logActions) {
    store.dispatch(toggleLogActions());
  }

  return next(action);
};
