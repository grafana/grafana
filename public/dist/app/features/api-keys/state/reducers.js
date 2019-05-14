import * as tslib_1 from "tslib";
import { ActionTypes } from './actions';
export var initialApiKeysState = {
    keys: [],
    searchQuery: '',
    hasFetched: false,
};
export var apiKeysReducer = function (state, action) {
    if (state === void 0) { state = initialApiKeysState; }
    switch (action.type) {
        case ActionTypes.LoadApiKeys:
            return tslib_1.__assign({}, state, { hasFetched: true, keys: action.payload });
        case ActionTypes.SetApiKeysSearchQuery:
            return tslib_1.__assign({}, state, { searchQuery: action.payload });
    }
    return state;
};
export default {
    apiKeys: apiKeysReducer,
};
//# sourceMappingURL=reducers.js.map