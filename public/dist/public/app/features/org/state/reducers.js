var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
export var initialState = {
    organization: {},
};
var organizationSlice = createSlice({
    name: 'organization',
    initialState: initialState,
    reducers: {
        organizationLoaded: function (state, action) {
            return __assign(__assign({}, state), { organization: action.payload });
        },
        setOrganizationName: function (state, action) {
            return __assign(__assign({}, state), { organization: __assign(__assign({}, state.organization), { name: action.payload }) });
        },
    },
});
export var setOrganizationName = (_a = organizationSlice.actions, _a.setOrganizationName), organizationLoaded = _a.organizationLoaded;
export var organizationReducer = organizationSlice.reducer;
export default {
    organization: organizationReducer,
};
//# sourceMappingURL=reducers.js.map