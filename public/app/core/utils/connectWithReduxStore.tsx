import React from 'react';
import { connect, Provider } from 'react-redux';
import { store } from '../../store/store';

export function connectWithStore(WrappedComponent: any, ...args: any[]) {
  const ConnectedWrappedComponent = (connect as any)(...args)(WrappedComponent);

  return (props: any) => {
    return <ConnectedWrappedComponent {...props} store={store} />;
  };
}

export function connectWithProvider(WrappedComponent: any, ...args: any[]) {
  const ConnectedWrappedComponent = (connect as any)(...args)(WrappedComponent);
  return (props: any) => {
    return (
      <Provider store={store}>
        <ConnectedWrappedComponent {...props} store={store} />
      </Provider>
    );
  };
}
