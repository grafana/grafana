var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
export var initialVariableEditorState = {
    id: '',
    isValid: true,
    errors: {},
    name: '',
    extended: null,
};
var variableEditorReducerSlice = createSlice({
    name: 'templating/editor',
    initialState: initialVariableEditorState,
    reducers: {
        setIdInEditor: function (state, action) {
            state.id = action.payload.id;
        },
        clearIdInEditor: function (state, action) {
            state.id = '';
        },
        variableEditorMounted: function (state, action) {
            state.name = action.payload.name;
        },
        variableEditorUnMounted: function (state, action) {
            return initialVariableEditorState;
        },
        changeVariableNameSucceeded: function (state, action) {
            state.name = action.payload.data.newName;
            delete state.errors['name'];
            state.isValid = Object.keys(state.errors).length === 0;
        },
        changeVariableNameFailed: function (state, action) {
            state.name = action.payload.newName;
            state.errors.name = action.payload.errorText;
            state.isValid = Object.keys(state.errors).length === 0;
        },
        addVariableEditorError: function (state, action) {
            state.errors[action.payload.errorProp] = action.payload.errorText;
            state.isValid = Object.keys(state.errors).length === 0;
        },
        removeVariableEditorError: function (state, action) {
            delete state.errors[action.payload.errorProp];
            state.isValid = Object.keys(state.errors).length === 0;
        },
        changeVariableEditorExtended: function (state, action) {
            var _a;
            state.extended = __assign(__assign({}, state.extended), (_a = {}, _a[action.payload.propName] = action.payload.propValue, _a));
        },
        cleanEditorState: function () { return initialVariableEditorState; },
    },
});
export var variableEditorReducer = variableEditorReducerSlice.reducer;
export var setIdInEditor = (_a = variableEditorReducerSlice.actions, _a.setIdInEditor), clearIdInEditor = _a.clearIdInEditor, changeVariableNameSucceeded = _a.changeVariableNameSucceeded, changeVariableNameFailed = _a.changeVariableNameFailed, variableEditorMounted = _a.variableEditorMounted, variableEditorUnMounted = _a.variableEditorUnMounted, changeVariableEditorExtended = _a.changeVariableEditorExtended, addVariableEditorError = _a.addVariableEditorError, removeVariableEditorError = _a.removeVariableEditorError, cleanEditorState = _a.cleanEditorState;
//# sourceMappingURL=reducer.js.map