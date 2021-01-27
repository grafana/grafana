import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { connectWithCleanUp } from '../../core/components/connectWithCleanUp';
import NextGenAlertingPage from './NextGenAlertingPage';
import { AlertDefinition, StoreState } from '../../types';
import { createAlertDefinition } from './state/actions';

interface OwnProps {}

interface ConnectedProps {
  alertDefinition: AlertDefinition;
}

interface DispatchProps {
  createAlertDefinition: typeof createAlertDefinition;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NewNGAlert extends PureComponent<Props> {
  render() {
    const { createAlertDefinition, alertDefinition } = this.props;

    return <NextGenAlertingPage alertDefinition={alertDefinition} saveDefinition={createAlertDefinition} />;
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state) => {
  return {
    alertDefinition: state.alertDefinition.alertDefinition,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  createAlertDefinition,
};

export default hot(module)(
  connectWithCleanUp(mapStateToProps, mapDispatchToProps, (state) => state.alertDefinition)(NewNGAlert)
);
