export var NEW_VARIABLE_ID = '00000000-0000-0000-0000-000000000000';
export var ALL_VARIABLE_TEXT = 'All';
export var ALL_VARIABLE_VALUE = '$__all';
export var NONE_VARIABLE_TEXT = 'None';
export var NONE_VARIABLE_VALUE = '';
export var initialVariablesState = {};
export var getInstanceState = function (state, id) {
    return state[id];
};
export var toVariableIdentifier = function (variable) {
    return { type: variable.type, id: variable.id };
};
// eslint-disable-next-line
export function toVariablePayload(obj, data) {
    return { type: obj.type, id: obj.id, data: data };
}
//# sourceMappingURL=types.js.map