import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect, MapStateToProps } from 'react-redux';
import SplitPane from 'react-split-pane';
import { DataSourceSelectItem } from '@grafana/data';
import { AlertingToolbar } from './components/AlertingToolbar';
import { AlertingQueryEditor } from './components/AlertingQueryEditor';
import { AlertDefinition } from './components/AlertDefinition';
import { AlertingQueryPreview } from './components/AlertingQueryPreview';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { StoreState } from '../../types';

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

  onDragStarted = () => {
    document.body.style.cursor = 'row-resize';
  };

  render() {
    return (
      <div>
        <AlertingToolbar />
        <SplitPane
          split="vertical"
          maxSize={1000}
          size={500}
          minSize={300}
          primary="second"
          onDragStarted={this.onDragStarted}
        >
          <SplitPane split="horizontal" size={500} primary="first">
            <AlertingQueryPreview />
            <AlertingQueryEditor dataSources={this.state.dataSources} onChangeDataSource={() => {}} />
          </SplitPane>
          <AlertDefinition />
        </SplitPane>
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {};
};

export default hot(module)(connect(mapStateToProps)(NextGenAlertingPage));
