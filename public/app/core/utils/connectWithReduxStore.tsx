import React from 'react';
import { connect } from 'react-redux';
import { store } from '../../store/store';

export function connectWithStore(WrappedComponent, ...args) {
  const ConnectedWrappedComponent = (connect as any)(...args)(WrappedComponent);

  return props => {
    return <ConnectedWrappedComponent {...props} store={store} />;
  };
}
