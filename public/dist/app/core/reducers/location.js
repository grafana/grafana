import * as tslib_1 from "tslib";
import { CoreActionTypes } from 'app/core/actions/location';
import { renderUrl } from 'app/core/utils/url';
import _ from 'lodash';
export var initialState = {
    url: '',
    path: '',
    query: {},
    routeParams: {},
    replace: false,
    lastUpdated: 0,
};
export var locationReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    switch (action.type) {
        case CoreActionTypes.UpdateLocation: {
            var _a = action.payload, path = _a.path, routeParams = _a.routeParams, replace = _a.replace;
            var query = action.payload.query || state.query;
            if (action.payload.partial) {
                query = _.defaults(query, state.query);
                query = _.omitBy(query, _.isNull);
            }
            return {
                url: renderUrl(path || state.path, query),
                path: path || state.path,
                query: tslib_1.__assign({}, query),
                routeParams: routeParams || state.routeParams,
                replace: replace === true,
                lastUpdated: new Date().getTime(),
            };
        }
    }
    return state;
};
//# sourceMappingURL=location.js.map