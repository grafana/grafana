import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { Spinner } from '@grafana/ui';
import { connectWithCleanUp } from '../../core/components/connectWithCleanUp';
import NextGenAlertingPage from './NextGenAlertingPage';
import { getAlertDefinition, updateAlertDefinition } from './state/actions';
import { getRouteParamsId } from '../../core/selectors/location';
import { AlertDefinition, StoreState } from '../../types';

interface OwnProps {}

interface ConnectedProps {
  alertDefinition: AlertDefinition;
  pageId: string;
}

interface DispatchProps {
  getAlertDefinition: typeof getAlertDefinition;
  updateAlertDefinition: typeof updateAlertDefinition;
}

type Props = ConnectedProps & DispatchProps & OwnProps;

export class EditNGAlert extends PureComponent<Props> {
  componentDidMount() {
    const { pageId, getAlertDefinition } = this.props;
    getAlertDefinition(pageId);
  }

  render() {
    const { alertDefinition, updateAlertDefinition } = this.props;

    if (alertDefinition.id < 1) {
      return <Spinner />;
    }
    return <NextGenAlertingPage alertDefinition={alertDefinition} saveDefinition={updateAlertDefinition} />;
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state) => {
  const pageId = getRouteParamsId(state.location);
  return {
    alertDefinition: state.alertDefinition.alertDefinition,
    pageId: (pageId as string) ?? '',
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  getAlertDefinition,
  updateAlertDefinition,
};

export default hot(module)(
  connectWithCleanUp(mapStateToProps, mapDispatchToProps, (state) => state.alertDefinition)(EditNGAlert)
);
