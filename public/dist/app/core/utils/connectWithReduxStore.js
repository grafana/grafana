import * as tslib_1 from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { store } from '../../store/store';
export function connectWithStore(WrappedComponent) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var ConnectedWrappedComponent = connect.apply(void 0, tslib_1.__spread(args))(WrappedComponent);
    return function (props) {
        return React.createElement(ConnectedWrappedComponent, tslib_1.__assign({}, props, { store: store }));
    };
}
//# sourceMappingURL=connectWithReduxStore.js.map