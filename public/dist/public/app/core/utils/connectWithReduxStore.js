import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { connect, Provider } from 'react-redux';
import { store } from '../../store/store';
export function connectWithStore(WrappedComponent) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var ConnectedWrappedComponent = connect.apply(void 0, __spreadArray([], __read(args), false))(WrappedComponent);
    // eslint-disable-next-line react/display-name
    return function (props) {
        return React.createElement(ConnectedWrappedComponent, __assign({}, props, { store: store }));
    };
}
export function connectWithProvider(WrappedComponent) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var ConnectedWrappedComponent = connect.apply(void 0, __spreadArray([], __read(args), false))(WrappedComponent);
    // eslint-disable-next-line react/display-name
    return function (props) {
        return (React.createElement(Provider, { store: store },
            React.createElement(ConnectedWrappedComponent, __assign({}, props, { store: store }))));
    };
}
//# sourceMappingURL=connectWithReduxStore.js.map