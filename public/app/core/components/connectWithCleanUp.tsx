import hoistNonReactStatics from 'hoist-non-react-statics';
import React, { ComponentType, FunctionComponent, useEffect } from 'react';
import { connect, MapDispatchToPropsParam, MapStateToPropsParam, useDispatch } from 'react-redux';

import { cleanUpAction, CleanUpAction } from '../actions/cleanUp';

export const connectWithCleanUp =
  <TStateProps extends {} = {}, TDispatchProps = {}, TOwnProps = {}, State = {}, Statics = {}>(
    mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>,
    mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>,
    cleanupAction: CleanUpAction
  ) =>
  (Component: ComponentType<any>) => {
    const ConnectedComponent = connect(
      mapStateToProps,
      mapDispatchToProps
      // @ts-ignore
    )(Component);

    const ConnectedComponentWithCleanUp: FunctionComponent = (props) => {
      const dispatch = useDispatch();
      useEffect(() => {
        return function cleanUp() {
          dispatch(cleanUpAction({ cleanupAction: cleanupAction }));
        };
      }, [dispatch]);
      // @ts-ignore
      return <ConnectedComponent {...props} />;
    };

    ConnectedComponentWithCleanUp.displayName = `ConnectWithCleanUp(${ConnectedComponent.displayName})`;
    hoistNonReactStatics(ConnectedComponentWithCleanUp, Component);
    type Hoisted = typeof ConnectedComponentWithCleanUp & Statics;

    return ConnectedComponentWithCleanUp as Hoisted;
  };
