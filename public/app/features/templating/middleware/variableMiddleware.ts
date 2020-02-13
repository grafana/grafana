import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from 'redux';
import { CoreEvents, StoreState } from '../../../types';
import { cleanUpDashboard, dashboardInitCompleted } from '../../dashboard/state/reducers';
import { DashboardModel } from '../../dashboard/state';
import { Emitter } from 'app/core/utils/emitter';
import {
  addVariable,
  changeVariableNameSucceeded,
  changeVariableOrder,
  duplicateVariable,
  moveVariableTypeToAngular,
  newVariable,
  removeVariable,
  setCurrentVariableValue,
  storeNewVariable,
  toVariablePayload,
  updateVariableCompleted,
} from '../state/actions';
import {
  MoveVariableType,
  VariableChangeOrderStart,
  VariableDuplicateVariableStart,
  VariableNewVariableStart,
  VariableRemoveVariable,
} from '../../../types/events';
import templateSrv from '../template_srv';
import { getVariable } from '../state/selectors';
import { emptyUuid } from '../state/types';
import { VariableModel } from '../variable';

let dashboardEvents: Emitter | null = null;

const onVariableTypeInAngularUpdated = (store: MiddlewareAPI<Dispatch, StoreState>) => ({
  name,
  label,
  index,
  type,
}: MoveVariableType) => {
  const model = {
    name,
    type,
    label,
    index,
  };
  store.dispatch(addVariable(toVariablePayload(model as VariableModel, { global: false, index, model })));
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

const onVariableChangeOrderStart = (store: MiddlewareAPI<Dispatch, StoreState>) => ({
  fromIndex,
  toIndex,
}: VariableChangeOrderStart) => {
  const stateSlice = Object.values(store.getState().templating.variables).find(
    s => s.variable.index === fromIndex || s.variable.index === toIndex
  );
  if (!stateSlice) {
    throw new Error(`Couldn't find state slice for variable with index:${fromIndex} or ${toIndex}`);
  }
  store.dispatch(
    changeVariableOrder({
      uuid: stateSlice.variable.uuid ?? '',
      type: stateSlice.variable.type,
      data: { fromIndex, toIndex },
    })
  );
};

const onVariableNewVariableStart = (store: MiddlewareAPI<Dispatch, StoreState>) => ({
  variablesInAngular,
}: VariableNewVariableStart) => {
  store.dispatch(newVariable({ uuid: emptyUuid, type: 'query', data: { variablesInAngular } }));
};

export const variableMiddleware: Middleware<{}, StoreState> = (store: MiddlewareAPI<Dispatch, StoreState>) => (
  next: Dispatch
) => (action: AnyAction) => {
  if (dashboardInitCompleted.match(action)) {
    const result = next(action);
    dashboardEvents = (store.getState().dashboard?.getModel() as DashboardModel)?.events;
    dashboardEvents.on(CoreEvents.variableTypeInAngularUpdated, onVariableTypeInAngularUpdated(store));
    dashboardEvents.on(CoreEvents.variableDuplicateVariableStart, onVariableDuplicateStart(store));
    dashboardEvents.on(CoreEvents.variableRemoveVariableStart, onVariableRemoveStart(store));
    dashboardEvents.on(CoreEvents.variableChangeOrderStart, onVariableChangeOrderStart(store));
    dashboardEvents.on(CoreEvents.variableNewVariableStart, onVariableNewVariableStart(store));
    return result;
  }

  if (cleanUpDashboard.match(action)) {
    const result = next(action);
    dashboardEvents?.off(CoreEvents.variableTypeInAngularUpdated, onVariableTypeInAngularUpdated(store));
    dashboardEvents?.off(CoreEvents.variableDuplicateVariableStart, onVariableDuplicateStart(store));
    dashboardEvents?.off(CoreEvents.variableRemoveVariableStart, onVariableRemoveStart(store));
    dashboardEvents?.off(CoreEvents.variableChangeOrderStart, onVariableChangeOrderStart(store));
    dashboardEvents?.off(CoreEvents.variableNewVariableStart, onVariableNewVariableStart(store));
    dashboardEvents = null;
    return result;
  }

  if (changeVariableNameSucceeded.match(action)) {
    const oldVariable = { ...getVariable(action.payload.uuid, store.getState()) };
    const oldName = oldVariable.name;
    const result = next(action);
    if (action.payload.uuid === emptyUuid) {
      return result;
    }
    dashboardEvents?.emit(CoreEvents.variableNameInStateUpdated, {
      type: action.payload.type,
      uuid: action.payload.uuid,
    });
    const newVariable = { ...getVariable(action.payload.uuid, store.getState()) };
    templateSrv.variableInitialized(newVariable);
    templateSrv.variableRemoved(oldName);
    return result;
  }

  if (addVariable.match(action)) {
    const result = next(action);
    const uuid = action.payload.uuid;
    const index = action.payload.data.index;
    const variable = { ...getVariable(uuid, store.getState()) };
    dashboardEvents?.emit(CoreEvents.variableMovedToState, { index, uuid });
    templateSrv.variableInitialized(variable);
    return result;
  }

  if (setCurrentVariableValue.match(action)) {
    const result = next(action);
    const uuid = action.payload.uuid;
    const variable = { ...getVariable(uuid, store.getState()) };
    templateSrv.variableInitialized(variable);
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
    if (action.payload.data.notifyAngular) {
      dashboardEvents?.emit(CoreEvents.variableRemoveVariableSucceeded, { uuid: action.payload.uuid ?? '' });
    }
    return result;
  }

  if (newVariable.match(action)) {
    const result = next(action);
    dashboardEvents?.emit(CoreEvents.variableNewVariableSucceeded);
    return result;
  }

  if (storeNewVariable.match(action)) {
    const result = next(action);
    dashboardEvents?.emit(CoreEvents.variableStoreNewVariableSucceeded, { uuid: action.payload.uuid ?? '' });
    return result;
  }

  return next(action);
};
