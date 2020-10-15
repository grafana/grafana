import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapStateToProps } from 'react-redux';
import { StoreState } from '../../types';
import { AlertingToolbar } from './components/AlertingToolbar';
import { AlertingQueryEditor } from './components/AlertingQueryEditor';
import { DataSourceSelectItem } from '@grafana/data';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { AlertDefinition } from './components/AlertDefinition';

interface OwnProps {}

interface ConnectedProps {}

interface DispatchProps {}

interface State {
  dataSources: DataSourceSelectItem[];
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NextGenAlertingPage extends PureComponent<Props, State> {
  state = { dataSources: [] };

  componentDidMount() {
    const dataSources = getDatasourceSrv().getMetricSources();

    this.setState({
      dataSources,
    });
  }

  render() {
    return (
      <div>
        <AlertingToolbar />
        <AlertingQueryEditor dataSources={this.state.dataSources} />
        <AlertDefinition />
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {};
};

export default hot(module)(connect(mapStateToProps)(NextGenAlertingPage));
