import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapStateToProps } from 'react-redux';
import { StoreState } from '../../types';
import { AlertingToolbar } from './components/AlertingToolbar';

interface OwnProps {}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NextGenAlertingPage extends PureComponent<Props> {
  render() {
    return (
      <div>
        <AlertingToolbar />
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {};
};

export default hot(module)(connect(mapStateToProps)(NextGenAlertingPage));
