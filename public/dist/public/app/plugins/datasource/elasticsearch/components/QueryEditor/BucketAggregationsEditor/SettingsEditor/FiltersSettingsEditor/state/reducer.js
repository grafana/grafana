import { __read, __spreadArray } from "tslib";
import { defaultFilter } from '../utils';
import { addFilter, changeFilter, removeFilter } from './actions';
export var reducer = function (state, action) {
    if (state === void 0) { state = []; }
    if (addFilter.match(action)) {
        return __spreadArray(__spreadArray([], __read(state), false), [defaultFilter()], false);
    }
    if (removeFilter.match(action)) {
        return state.slice(0, action.payload).concat(state.slice(action.payload + 1));
    }
    if (changeFilter.match(action)) {
        return state.map(function (filter, index) {
            if (index !== action.payload.index) {
                return filter;
            }
            return action.payload.filter;
        });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map