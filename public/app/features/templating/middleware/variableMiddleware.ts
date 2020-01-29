import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { CoreEvents, StoreState } from '../../../types';
import { cleanUpDashboard, dashboardInitCompleted } from '../../dashboard/state/actions';
import { DashboardModel } from '../../dashboard/state';
import { Emitter } from 'app/core/utils/emitter';
import { changeVariableNameSucceeded } from '../state/actions';
import { appEvents } from 'app/core/core';

let dashboardEvents: Emitter = null;

export const variableMiddleware: Middleware<{}, StoreState> = (store: MiddlewareAPI<Dispatch, StoreState>) => (
  next: Dispatch
) => (action: AnyAction) => {
  if (dashboardInitCompleted.match(action)) {
    const result = next(action);
    dashboardEvents = (store.getState().dashboard?.model as DashboardModel).events;
    return result;
  }

  if (cleanUpDashboard.match(action)) {
    const result = next(action);
    dashboardEvents = null;
    return result;
  }

  if (changeVariableNameSucceeded.match(action)) {
    const result = next(action);
    dashboardEvents?.emit(CoreEvents.variableNameInStateUpdated, {
      type: action.payload.type,
      uuid: action.payload.uuid,
    });
    appEvents.emit(CoreEvents.variableNameInStateUpdated, { type: action.payload.type, uuid: action.payload.uuid });
    return result;
  }

  return next(action);
};
