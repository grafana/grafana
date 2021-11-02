var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
export var initialApiKeysState = {
    keys: [],
    searchQuery: '',
    hasFetched: false,
};
var apiKeysSlice = createSlice({
    name: 'apiKeys',
    initialState: initialApiKeysState,
    reducers: {
        apiKeysLoaded: function (state, action) {
            return __assign(__assign({}, state), { hasFetched: true, keys: action.payload });
        },
        setSearchQuery: function (state, action) {
            return __assign(__assign({}, state), { searchQuery: action.payload });
        },
    },
});
export var setSearchQuery = (_a = apiKeysSlice.actions, _a.setSearchQuery), apiKeysLoaded = _a.apiKeysLoaded;
export var apiKeysReducer = apiKeysSlice.reducer;
export default {
    apiKeys: apiKeysReducer,
};
//# sourceMappingURL=reducers.js.map