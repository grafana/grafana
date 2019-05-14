import * as tslib_1 from "tslib";
import { ActionTypes } from './actions';
var initialState = {
    organization: {},
};
var organizationReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    switch (action.type) {
        case ActionTypes.LoadOrganization:
            return tslib_1.__assign({}, state, { organization: action.payload });
        case ActionTypes.SetOrganizationName:
            return tslib_1.__assign({}, state, { organization: tslib_1.__assign({}, state.organization, { name: action.payload }) });
    }
    return state;
};
export default {
    organization: organizationReducer,
};
//# sourceMappingURL=reducers.js.map