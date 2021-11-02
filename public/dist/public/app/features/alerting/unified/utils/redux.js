import { __assign } from "tslib";
import { isArray } from 'angular';
import { createSlice, isAsyncThunkAction } from '@reduxjs/toolkit';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/core';
export var initialAsyncRequestState = Object.freeze({
    loading: false,
    dispatched: false,
});
function requestStateReducer(asyncThunk, state, action) {
    if (state === void 0) { state = initialAsyncRequestState; }
    if (asyncThunk.pending.match(action)) {
        return {
            result: state.result,
            loading: true,
            error: state.error,
            dispatched: true,
            requestId: action.meta.requestId,
        };
    }
    else if (asyncThunk.fulfilled.match(action)) {
        if (state.requestId === undefined || state.requestId === action.meta.requestId) {
            return __assign(__assign({}, state), { result: action.payload, loading: false, error: undefined });
        }
    }
    else if (asyncThunk.rejected.match(action)) {
        if (state.requestId === action.meta.requestId) {
            return __assign(__assign({}, state), { loading: false, error: action.error });
        }
    }
    return state;
}
/*
 * createAsyncSlice creates a slice based on a given async action, exposing it's state.
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncSlice(name, asyncThunk) {
    return createSlice({
        name: name,
        initialState: initialAsyncRequestState,
        reducers: {},
        extraReducers: function (builder) {
            return builder.addDefaultCase(function (state, action) {
                return requestStateReducer(asyncThunk, state, action);
            });
        },
    });
}
/*
 * createAsyncMapSlice creates a slice based on a given async action exposing a map of request states.
 * separate requests are uniquely indentified by result of provided getEntityId function
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncMapSlice(name, asyncThunk, getEntityId) {
    return createSlice({
        name: name,
        initialState: {},
        reducers: {},
        extraReducers: function (builder) {
            return builder.addDefaultCase(function (state, action) {
                var _a;
                if (isAsyncThunkAction(asyncThunk)(action)) {
                    var asyncAction = action;
                    var entityId = getEntityId(asyncAction.meta.arg);
                    return __assign(__assign({}, state), (_a = {}, _a[entityId] = requestStateReducer(asyncThunk, state[entityId], asyncAction), _a));
                }
                return state;
            });
        },
    });
}
// rethrow promise error in redux serialized format
export function withSerializedError(p) {
    return p.catch(function (e) {
        var err = {
            message: messageFromError(e),
            code: e.statusCode,
        };
        throw err;
    });
}
export function withAppEvents(p, options) {
    return p
        .then(function (v) {
        if (options.successMessage) {
            appEvents.emit(AppEvents.alertSuccess, [options.successMessage]);
        }
        return v;
    })
        .catch(function (e) {
        var _a;
        var msg = messageFromError(e);
        appEvents.emit(AppEvents.alertError, [((_a = options.errorMessage) !== null && _a !== void 0 ? _a : 'Error') + ": " + msg]);
        throw e;
    });
}
export function isFetchError(e) {
    return typeof e === 'object' && e !== null && 'status' in e && 'data' in e;
}
export function messageFromError(e) {
    var _a, _b, _c, _d, _e;
    if (isFetchError(e)) {
        if ((_a = e.data) === null || _a === void 0 ? void 0 : _a.message) {
            var msg = (_b = e.data) === null || _b === void 0 ? void 0 : _b.message;
            if (typeof ((_c = e.data) === null || _c === void 0 ? void 0 : _c.error) === 'string') {
                msg += "; " + e.data.error;
            }
            return msg;
        }
        else if (isArray(e.data) && e.data.length && ((_d = e.data[0]) === null || _d === void 0 ? void 0 : _d.message)) {
            return e.data
                .map(function (d) { return d === null || d === void 0 ? void 0 : d.message; })
                .filter(function (m) { return !!m; })
                .join(' ');
        }
        else if (e.statusText) {
            return e.statusText;
        }
    }
    return ((_e = e) === null || _e === void 0 ? void 0 : _e.message) || String(e);
}
//# sourceMappingURL=redux.js.map