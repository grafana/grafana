import hoistNonReactStatics from 'hoist-non-react-statics';
import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { useDispatch } from 'app/types';
import { cleanUpAction } from '../actions/cleanUp';
export const connectWithCleanUp = (mapStateToProps, mapDispatchToProps, cleanupAction) => (Component) => {
    const ConnectedComponent = connect(mapStateToProps, mapDispatchToProps
    // @ts-ignore
    )(Component);
    const ConnectedComponentWithCleanUp = (props) => {
        const dispatch = useDispatch();
        useEffect(() => {
            return function cleanUp() {
                dispatch(cleanUpAction({ cleanupAction: cleanupAction }));
            };
        }, [dispatch]);
        // @ts-ignore
        return React.createElement(ConnectedComponent, Object.assign({}, props));
    };
    ConnectedComponentWithCleanUp.displayName = `ConnectWithCleanUp(${ConnectedComponent.displayName})`;
    hoistNonReactStatics(ConnectedComponentWithCleanUp, Component);
    return ConnectedComponentWithCleanUp;
};
//# sourceMappingURL=connectWithCleanUp.js.map