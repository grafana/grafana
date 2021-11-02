import { __assign } from "tslib";
import { connect, useDispatch } from 'react-redux';
import { cleanUpAction } from '../actions/cleanUp';
import React, { useEffect } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';
export var connectWithCleanUp = function (mapStateToProps, mapDispatchToProps, stateSelector) { return function (Component) {
    var ConnectedComponent = connect(mapStateToProps, mapDispatchToProps
    // @ts-ignore
    )(Component);
    var ConnectedComponentWithCleanUp = function (props) {
        var dispatch = useDispatch();
        useEffect(function () {
            return function cleanUp() {
                dispatch(cleanUpAction({ stateSelector: stateSelector }));
            };
        }, [dispatch]);
        // @ts-ignore
        return React.createElement(ConnectedComponent, __assign({}, props));
    };
    ConnectedComponentWithCleanUp.displayName = "ConnectWithCleanUp(" + ConnectedComponent.displayName + ")";
    hoistNonReactStatics(ConnectedComponentWithCleanUp, Component);
    return ConnectedComponentWithCleanUp;
}; };
//# sourceMappingURL=connectWithCleanUp.js.map