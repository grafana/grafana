import React from 'react';
import { connect } from 'react-redux';
import { store } from '../../store/configureStore';

export function connectWithStore(WrappedComponent, ...args) {
  const ConnectedWrappedComponent = connect(...args)(WrappedComponent);

  return props => {
    return <ConnectedWrappedComponent {...props} store={store} />;
  };
}
