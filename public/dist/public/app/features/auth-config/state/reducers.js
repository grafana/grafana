import { createSlice } from '@reduxjs/toolkit';
export const initialState = {
    settings: {},
    providerStatuses: {},
    isLoading: false,
};
const authConfigSlice = createSlice({
    name: 'authConfig',
    initialState,
    reducers: {
        settingsUpdated: (state, action) => {
            return Object.assign(Object.assign({}, state), { settings: action.payload });
        },
        providerStatusesLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { providerStatuses: action.payload });
        },
        loadingBegin: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: true });
        },
        loadingEnd: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: false });
        },
        setError: (state, action) => {
            return Object.assign(Object.assign({}, state), { updateError: action.payload });
        },
        resetError: (state) => {
            return Object.assign(Object.assign({}, state), { updateError: undefined });
        },
        setWarning: (state, action) => {
            return Object.assign(Object.assign({}, state), { warning: action.payload });
        },
        resetWarning: (state) => {
            return Object.assign(Object.assign({}, state), { warning: undefined });
        },
    },
});
export const { settingsUpdated, providerStatusesLoaded, loadingBegin, loadingEnd, setError, resetError, setWarning, resetWarning, } = authConfigSlice.actions;
export const authConfigReducer = authConfigSlice.reducer;
export default {
    authConfig: authConfigReducer,
};
//# sourceMappingURL=reducers.js.map