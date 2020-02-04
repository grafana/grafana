import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { CoreEvents, StoreState } from '../../../types';
import { cleanUpDashboard, dashboardInitCompleted } from '../../dashboard/state/actions';
import { DashboardModel } from '../../dashboard/state';
import { Emitter } from 'app/core/utils/emitter';
import {
  addVariable,
  changeVariableNameSucceeded,
  duplicateVariable,
  moveVariableTypeToAngular,
  removeVariable,
  setCurrentVariableValue,
  toVariablePayload,
  updateVariableCompleted,
  VariablePayload,
} from '../state/actions';
import { variableAdapters } from '../adapters';
import { MoveVariableType, VariableDuplicateVariableStart, VariableRemoveVariable } from '../../../types/events';
import templateSrv from '../template_srv';
import { getVariable } from '../state/selectors';
import { VariableState } from '../state/types';

let dashboardEvents: Emitter | null = null;

const onVariableTypeInAngularUpdated = (store: MiddlewareAPI<Dispatch, StoreState>) => ({
  name,
  label,
  index,
  type,
}: MoveVariableType) => {
  const initialState = variableAdapters
    .get(type)
    .reducer((undefined as unknown) as VariableState, { type: '', payload: {} as VariablePayload<any> });
  const model = {
    ...initialState.variable,
    name,
    type,
    label,
    index,
  };
  store.dispatch(addVariable(toVariablePayload(model, { global: false, index, model })));
};

const onVariableDuplicateStart = (store: MiddlewareAPI<Dispatch, StoreState>) => ({
  uuid,
  type,
  variablesInAngular,
}: VariableDuplicateVariableStart) => {
  store.dispatch(duplicateVariable({ uuid, type, data: { variablesInAngular } }));
};

const onVariableRemoveStart = (store: MiddlewareAPI<Dispatch, StoreState>) => ({
  uuid,
  type,
}: VariableRemoveVariable) => {
  store.dispatch(removeVariable({ uuid, type, data: { notifyAngular: true } }));
};

export const variableMiddleware: Middleware<{}, StoreState> = (store: MiddlewareAPI<Dispatch, StoreState>) => (
  next: Dispatch
) => (action: AnyAction) => {
  if (dashboardInitCompleted.match(action)) {
    const result = next(action);
    dashboardEvents = (store.getState().dashboard?.model as DashboardModel).events;
    dashboardEvents.on(CoreEvents.variableTypeInAngularUpdated, onVariableTypeInAngularUpdated(store));
    dashboardEvents.on(CoreEvents.variableDuplicateVariableStart, onVariableDuplicateStart(store));
    dashboardEvents.on(CoreEvents.variableRemoveVariableStart, onVariableRemoveStart(store));
    return result;
  }

  if (cleanUpDashboard.match(action)) {
    const result = next(action);
    dashboardEvents?.off(CoreEvents.variableTypeInAngularUpdated, onVariableTypeInAngularUpdated(store));
    dashboardEvents?.off(CoreEvents.variableDuplicateVariableStart, onVariableDuplicateStart(store));
    dashboardEvents?.off(CoreEvents.variableRemoveVariableStart, onVariableRemoveStart(store));
    dashboardEvents = null;
    return result;
  }

  if (changeVariableNameSucceeded.match(action)) {
    const oldName = getVariable(action.payload.uuid, store.getState()).name;
    const result = next(action);
    dashboardEvents?.emit(CoreEvents.variableNameInStateUpdated, {
      type: action.payload.type,
      uuid: action.payload.uuid,
    });
    templateSrv.variableInitialized(getVariable(action.payload.uuid, store.getState()));
    templateSrv.variableRemoved(oldName);
    return result;
  }

  if (addVariable.match(action)) {
    const result = next(action);
    const uuid = action.payload.uuid;
    const index = action.payload.data.index;
    dashboardEvents?.emit(CoreEvents.variableMovedToState, { index, uuid });
    templateSrv.variableInitialized(getVariable(uuid, store.getState()));
    return result;
  }

  if (setCurrentVariableValue.match(action)) {
    const result = next(action);
    const uuid = action.payload.uuid;
    templateSrv.variableInitialized(getVariable(uuid, store.getState()));
    return result;
  }

  if (moveVariableTypeToAngular.match(action)) {
    const result = next(action);
    const { name, label, index, type } = action.payload.data;
    dashboardEvents?.emit(CoreEvents.variableMovedToAngular, { name, label, index, type });
    return result;
  }

  if (updateVariableCompleted.match(action)) {
    const result = next(action);
    if (action.payload.data.notifyAngular) {
      dashboardEvents?.emit(CoreEvents.variableEditorChangeMode, 'list');
    }
    return result;
  }

  if (duplicateVariable.match(action)) {
    const { newUuid } = action.payload.data;
    const result = next(action);
    const variable = getVariable(newUuid, store.getState());
    dashboardEvents?.emit(CoreEvents.variableDuplicateVariableSucceeded, { uuid: variable.uuid ?? '' });
    return result;
  }

  if (removeVariable.match(action)) {
    const result = next(action);
    dashboardEvents?.emit(CoreEvents.variableRemoveVariableSucceeded, { uuid: action.payload.uuid ?? '' });
    return result;
  }

  return next(action);
};
