import { createSlice } from '@reduxjs/toolkit';
export const initialVariableEditorState = {
    id: '',
    isValid: true,
    errors: {},
    name: '',
    extended: null,
};
const variableEditorReducerSlice = createSlice({
    name: 'templating/editor',
    initialState: initialVariableEditorState,
    reducers: {
        variableEditorMounted: (state, action) => {
            state.name = action.payload.name;
            state.id = action.payload.id;
        },
        variableEditorUnMounted: (state, action) => {
            return initialVariableEditorState;
        },
        changeVariableNameSucceeded: (state, action) => {
            state.name = action.payload.data.newName;
            delete state.errors['name'];
            state.isValid = Object.keys(state.errors).length === 0;
        },
        changeVariableNameFailed: (state, action) => {
            state.name = action.payload.newName;
            state.errors.name = action.payload.errorText;
            state.isValid = Object.keys(state.errors).length === 0;
        },
        addVariableEditorError: (state, action) => {
            state.errors[action.payload.errorProp] = action.payload.errorText;
            state.isValid = Object.keys(state.errors).length === 0;
        },
        removeVariableEditorError: (state, action) => {
            delete state.errors[action.payload.errorProp];
            state.isValid = Object.keys(state.errors).length === 0;
        },
        changeVariableEditorExtended: (state, action) => {
            state.extended = Object.assign(Object.assign({}, state.extended), action.payload);
        },
        cleanEditorState: () => initialVariableEditorState,
    },
});
export const variableEditorReducer = variableEditorReducerSlice.reducer;
export const { changeVariableNameSucceeded, changeVariableNameFailed, variableEditorMounted, variableEditorUnMounted, changeVariableEditorExtended, addVariableEditorError, removeVariableEditorError, cleanEditorState, } = variableEditorReducerSlice.actions;
//# sourceMappingURL=reducer.js.map