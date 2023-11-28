import { BusEventWithPayload, LoadingState, VariableHide, } from '@grafana/data';
export { 
/** @deprecated Import from @grafana/data instead */
VariableRefresh, 
/** @deprecated Import from @grafana/data instead */
VariableSort, 
/** @deprecated Import from @grafana/data instead */
VariableHide, } from '@grafana/data';
import { NEW_VARIABLE_ID } from './constants';
export var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["NotStarted"] = "Not started";
    TransactionStatus["Fetching"] = "Fetching";
    TransactionStatus["Completed"] = "Completed";
})(TransactionStatus || (TransactionStatus = {}));
export const initialVariableModelState = {
    id: NEW_VARIABLE_ID,
    rootStateKey: null,
    name: '',
    // TODO: in a later PR, remove type and type this object to Partial<BaseVariableModel>
    type: 'query',
    global: false,
    index: -1,
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    state: LoadingState.NotStarted,
    error: null,
    description: null,
};
export class VariablesChanged extends BusEventWithPayload {
}
VariablesChanged.type = 'variables-changed';
export class VariablesTimeRangeProcessDone extends BusEventWithPayload {
}
VariablesTimeRangeProcessDone.type = 'variables-time-range-process-done';
export class VariablesChangedInUrl extends BusEventWithPayload {
}
VariablesChangedInUrl.type = 'variables-changed-in-url';
//# sourceMappingURL=types.js.map