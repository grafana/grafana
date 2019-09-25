import { MapStateToPropsParam, MapDispatchToPropsParam, connect, useDispatch } from 'react-redux';
import { StateSelector, cleanUpAction } from '../actions/cleanUp';
import React, { ComponentType, FunctionComponent, useEffect } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

export const connectWithCleanUp = <
  TStateProps extends {} = {},
  TDispatchProps = {},
  TOwnProps = {},
  State = {},
  TSelector extends object = {}
>(
  mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>,
  mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>,
  stateSelector: StateSelector<TSelector>
) => (Component: ComponentType<any>) => {
  const ConnectedComponent = connect(
    mapStateToProps,
    mapDispatchToProps
  )(Component);

  const ConnectedComponentWithCleanUp: FunctionComponent = props => {
    const dispatch = useDispatch();
    useEffect(() => {
      return () => dispatch(cleanUpAction({ stateSelector }));
    });
    // @ts-ignore
    return <ConnectedComponent {...props} />;
  };

  ConnectedComponentWithCleanUp.displayName = `ConnectWithCleanUp(${ConnectedComponent.displayName})`;
  hoistNonReactStatics(ConnectedComponentWithCleanUp, Component);
  type Hoisted = typeof ConnectedComponentWithCleanUp;

  return ConnectedComponentWithCleanUp as Hoisted;
};
