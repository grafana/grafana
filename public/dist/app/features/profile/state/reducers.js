import config from 'app/core/config';
export var initialState = {
    orgId: config.bootData.user.orgId,
};
export var userReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    return state;
};
export default {
    user: userReducer,
};
//# sourceMappingURL=reducers.js.map