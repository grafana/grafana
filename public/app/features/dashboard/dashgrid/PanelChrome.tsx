// Libraries
import React, { ComponentClass, PureComponent } from 'react';

// Services
import { getTimeSrv } from '../time_srv';

// Components
import { PanelHeader } from './PanelHeader';
import { DataPanel } from './DataPanel';

// Types
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { TimeRange, PanelProps } from 'app/types';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  component: ComponentClass<PanelProps>;
}

export interface State {
  refreshCounter: number;
  timeRange?: TimeRange;
}

export class PanelChrome extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      refreshCounter: 0,
    };
  }

  componentDidMount() {
    this.props.dashboard.panelInitialized(this.props.panel);
    this.props.panel.events.on('refresh', this.onRefresh);
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onRefresh);
  }

  onRefresh = () => {
    const timeSrv = getTimeSrv();
    const timeRange = timeSrv.timeRange();

    this.setState({
      refreshCounter: this.state.refreshCounter + 1,
      timeRange: timeRange,
    });
  };

  get isVisible() {
    return this.props.dashboard.otherPanelInFullscreen(this.props.panel);
  }

  render() {
    const { panel, dashboard } = this.props;
    const { datasource, targets } = panel;
    const { refreshCounter } = this.state;
    const PanelComponent = this.props.component;

    return (
      <div className="panel-container">
        <PanelHeader panel={panel} dashboard={dashboard} />
        <div className="panel-content">
          <DataPanel
            datasource={datasource}
            queries={targets}
            isVisible={this.isVisible}
            refreshCounter={refreshCounter}
          >
            {({ loading, data }) => {
              return <PanelComponent loading={loading} data={data} />;
            }}
          </DataPanel>
        </div>
      </div>
    );
  }
}
