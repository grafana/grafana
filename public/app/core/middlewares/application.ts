import { Store, Dispatch } from 'redux';
import { StoreState } from 'app/types/store';
import { ActionOf } from '../redux/actionCreatorFactory';
import { toggleLogActions } from '../actions/application';

export const toggleLogActionsMiddleware = (store: Store<StoreState>) => (next: Dispatch) => (action: ActionOf<any>) => {
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
