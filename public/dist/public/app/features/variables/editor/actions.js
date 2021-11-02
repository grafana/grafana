import { __assign, __awaiter, __generator } from "tslib";
import { getEditorVariables, getNewVariabelIndex, getVariable, getVariables } from '../state/selectors';
import { changeVariableNameFailed, changeVariableNameSucceeded, clearIdInEditor, setIdInEditor, variableEditorMounted, variableEditorUnMounted, } from './reducer';
import { variableAdapters } from '../adapters';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { cloneDeep } from 'lodash';
import { addVariable, removeVariable } from '../state/sharedReducer';
import { updateOptions } from '../state/actions';
import { initInspect } from '../inspect/reducer';
import { createUsagesNetwork, transformUsagesToNetwork } from '../inspect/utils';
export var variableEditorMount = function (identifier) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            dispatch(variableEditorMounted({ name: getVariable(identifier.id).name }));
            return [2 /*return*/];
        });
    }); };
};
export var variableEditorUnMount = function (identifier) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            dispatch(variableEditorUnMounted(toVariablePayload(identifier)));
            return [2 /*return*/];
        });
    }); };
};
export var onEditorUpdate = function (identifier) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dispatch(updateOptions(identifier))];
                case 1:
                    _a.sent();
                    dispatch(switchToListMode());
                    return [2 /*return*/];
            }
        });
    }); };
};
export var changeVariableName = function (identifier, newName) {
    return function (dispatch, getState) {
        var errorText = null;
        if (!newName.match(/^(?!__).*$/)) {
            errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
        }
        if (!newName.match(/^\w+$/)) {
            errorText = 'Only word and digit characters are allowed in variable names';
        }
        var variables = getVariables(getState());
        var foundVariables = variables.filter(function (v) { return v.name === newName && v.id !== identifier.id; });
        if (foundVariables.length) {
            errorText = 'Variable with the same name already exists';
        }
        if (errorText) {
            dispatch(changeVariableNameFailed({ newName: newName, errorText: errorText }));
            return;
        }
        dispatch(completeChangeVariableName(identifier, newName));
    };
};
export var completeChangeVariableName = function (identifier, newName) { return function (dispatch, getState) {
    var originalVariable = getVariable(identifier.id, getState());
    if (originalVariable.name === newName) {
        dispatch(changeVariableNameSucceeded(toVariablePayload(identifier, { newName: newName })));
        return;
    }
    var model = __assign(__assign({}, cloneDeep(originalVariable)), { name: newName, id: newName });
    var global = originalVariable.global;
    var index = originalVariable.index;
    var renamedIdentifier = toVariableIdentifier(model);
    dispatch(addVariable(toVariablePayload(renamedIdentifier, { global: global, index: index, model: model })));
    dispatch(changeVariableNameSucceeded(toVariablePayload(renamedIdentifier, { newName: newName })));
    dispatch(switchToEditMode(renamedIdentifier));
    dispatch(removeVariable(toVariablePayload(identifier, { reIndex: false })));
}; };
export var switchToNewMode = function (type) {
    if (type === void 0) { type = 'query'; }
    return function (dispatch, getState) {
        var id = getNextAvailableId(type, getVariables(getState()));
        var identifier = { type: type, id: id };
        var global = false;
        var index = getNewVariabelIndex(getState());
        var model = cloneDeep(variableAdapters.get(type).initialState);
        model.id = id;
        model.name = id;
        dispatch(addVariable(toVariablePayload(identifier, { global: global, model: model, index: index })));
        dispatch(setIdInEditor({ id: identifier.id }));
    };
};
export var switchToEditMode = function (identifier) { return function (dispatch) {
    dispatch(setIdInEditor({ id: identifier.id }));
}; };
export var switchToListMode = function () { return function (dispatch, getState) {
    dispatch(clearIdInEditor());
    var state = getState();
    var variables = getEditorVariables(state);
    var dashboard = state.dashboard.getModel();
    var _a = createUsagesNetwork(variables, dashboard), unknown = _a.unknown, usages = _a.usages;
    var unknownsNetwork = transformUsagesToNetwork(unknown);
    var unknownExits = Object.keys(unknown).length > 0;
    var usagesNetwork = transformUsagesToNetwork(usages);
    dispatch(initInspect({ unknown: unknown, usages: usages, usagesNetwork: usagesNetwork, unknownsNetwork: unknownsNetwork, unknownExits: unknownExits }));
}; };
export function getNextAvailableId(type, variables) {
    var counter = 0;
    var nextId = "" + type + counter;
    while (variables.find(function (variable) { return variable.id === nextId; })) {
        nextId = "" + type + ++counter;
    }
    return nextId;
}
//# sourceMappingURL=actions.js.map