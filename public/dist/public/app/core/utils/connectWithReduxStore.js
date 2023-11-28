import React from 'react';
import { connect, Provider } from 'react-redux';
import { store } from '../../store/store';
export function connectWithStore(WrappedComponent, ...args) {
    const ConnectedWrappedComponent = connect(...args)(WrappedComponent);
    // eslint-disable-next-line react/display-name
    return (props) => {
        return React.createElement(ConnectedWrappedComponent, Object.assign({}, props, { store: store }));
    };
}
export function connectWithProvider(WrappedComponent, ...args) {
    const ConnectedWrappedComponent = connect(...args)(WrappedComponent);
    // eslint-disable-next-line react/display-name
    return (props) => {
        return (React.createElement(Provider, { store: store },
            React.createElement(ConnectedWrappedComponent, Object.assign({}, props, { store: store }))));
    };
}
//# sourceMappingURL=connectWithReduxStore.js.map