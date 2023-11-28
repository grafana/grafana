import { createSlice, isAsyncThunkAction } from '@reduxjs/toolkit';
import { AppEvents } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { PERCONA_CANCELLED_ERROR_NAME } from 'app/percona/shared/core';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logInfo, LogMessages } from '../Analytics';
export const createInitialAsyncRequestState = (state) => Object.freeze({
    loading: false,
    result: state,
    error: undefined,
    dispatched: false,
});
export const initialAsyncRequestState = createInitialAsyncRequestState(undefined);
function requestStateReducer(asyncThunk, state = initialAsyncRequestState, action) {
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
            return Object.assign(Object.assign({}, state), { result: action.payload, loading: false, error: undefined });
        }
    }
    else if (asyncThunk.rejected.match(action)) {
        if (state.requestId === action.meta.requestId) {
            return Object.assign(Object.assign({}, state), { loading: false, error: action.error });
        }
    }
    return state;
}
/*
 * createAsyncSlice creates a slice based on a given async action, exposing its state.
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncSlice(name, asyncThunk, 
// @PERCONA
initialState) {
    return createSlice({
        name,
        initialState: initialState
            ? createInitialAsyncRequestState(initialState)
            : initialAsyncRequestState,
        reducers: {},
        extraReducers: (builder) => builder.addDefaultCase((state, action) => requestStateReducer(asyncThunk, state, action)),
    });
}
/*
 * createAsyncMapSlice creates a slice based on a given async action exposing a map of request states.
 * separate requests are uniquely indentified by result of provided getEntityId function
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncMapSlice(name, asyncThunk, getEntityId) {
    return createSlice({
        name,
        initialState: {},
        reducers: {},
        extraReducers: (builder) => builder.addDefaultCase((state, action) => {
            if (isAsyncThunkAction(asyncThunk)(action)) {
                const asyncAction = action;
                const entityId = getEntityId(asyncAction.meta.arg);
                return Object.assign(Object.assign({}, state), { [entityId]: requestStateReducer(asyncThunk, state[entityId], asyncAction) });
            }
            return state;
        }),
    });
}
// rethrow promise error in redux serialized format
export function withSerializedError(p) {
    return p.catch((e) => {
        const err = {
            message: messageFromError(e),
            code: e.statusCode,
            // @PERCONA
            name: isApiCancelError(e) ? PERCONA_CANCELLED_ERROR_NAME : '',
        };
        throw err;
    });
}
export function withAppEvents(p, options) {
    return p
        .then((v) => {
        if (options.successMessage) {
            appEvents.emit(AppEvents.alertSuccess, [options.successMessage]);
        }
        return v;
    })
        .catch((e) => {
        var _a;
        const msg = messageFromError(e);
        appEvents.emit(AppEvents.alertError, [`${(_a = options.errorMessage) !== null && _a !== void 0 ? _a : 'Error'}: ${msg}`]);
        throw e;
    });
}
export const UNKNOW_ERROR = 'Unknown Error';
export function messageFromError(e) {
    var _a, _b, _c, _d;
    if (isFetchError(e)) {
        if ((_a = e.data) === null || _a === void 0 ? void 0 : _a.message) {
            let msg = (_b = e.data) === null || _b === void 0 ? void 0 : _b.message;
            if (typeof ((_c = e.data) === null || _c === void 0 ? void 0 : _c.error) === 'string') {
                msg += `; ${e.data.error}`;
            }
            return msg;
        }
        else if (Array.isArray(e.data) && e.data.length && ((_d = e.data[0]) === null || _d === void 0 ? void 0 : _d.message)) {
            return e.data
                .map((d) => d === null || d === void 0 ? void 0 : d.message)
                .filter((m) => !!m)
                .join(' ');
        }
        else if (e.statusText) {
            return e.statusText;
        }
    }
    // message in e object, return message
    const errorMessage = e === null || e === void 0 ? void 0 : e.message;
    if (errorMessage) {
        return errorMessage;
    }
    // for some reason (upstream this code), sometimes we get an object without the message field neither in the e.data and nor in e.message
    // in this case we want to avoid String(e) printing [object][object]
    logInfo(LogMessages.unknownMessageFromError, { error: JSON.stringify(e) });
    return UNKNOW_ERROR;
}
export function isAsyncRequestMapSliceSettled(slice) {
    return Object.values(slice).every(isAsyncRequestStateSettled);
}
export function isAsyncRequestStateSettled(state) {
    return state.dispatched && !state.loading;
}
export function isAsyncRequestMapSliceFulfilled(slice) {
    return Object.values(slice).every(isAsyncRequestStateFulfilled);
}
export function isAsyncRequestStateFulfilled(state) {
    return state.dispatched && !state.loading && !state.error;
}
export function isAsyncRequestMapSlicePending(slice) {
    return Object.values(slice).some(isAsyncRequestStatePending);
}
export function isAsyncRequestMapSlicePartiallyDispatched(slice) {
    return Object.values(slice).some((state) => state.dispatched);
}
export function isAsyncRequestMapSlicePartiallyFulfilled(slice) {
    return Object.values(slice).some(isAsyncRequestStateFulfilled);
}
export function isAsyncRequestStatePending(state) {
    if (!state) {
        return false;
    }
    return state.dispatched && state.loading;
}
//# sourceMappingURL=redux.js.map