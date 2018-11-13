// Libraries
import React, { ComponentClass, PureComponent } from 'react';

// Services
import { getTimeSrv, TimeSrv } from '../time_srv';

// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import { DataPanel } from './DataPanel';

// Utils
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';

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
  renderCounter: number;
  timeInfo?: string;
  timeRange?: TimeRange;
}

export class PanelChrome extends PureComponent<Props, State> {
  timeSrv: TimeSrv = getTimeSrv();

  constructor(props) {
    super(props);

    this.state = {
      refreshCounter: 0,
      renderCounter: 0,
    };
  }

  componentDidMount() {
    this.props.panel.events.on('refresh', this.onRefresh);
    this.props.panel.events.on('render', this.onRender);
    this.props.dashboard.panelInitialized(this.props.panel);
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onRefresh);
  }

  onRefresh = () => {
    console.log('onRefresh');
    if (!this.isVisible) {
      return;
    }

    const { panel } = this.props;
    const timeData = applyPanelTimeOverrides(panel, this.timeSrv.timeRange());

    this.setState({
      refreshCounter: this.state.refreshCounter + 1,
      timeRange: timeData.timeRange,
      timeInfo: timeData.timeInfo,
    });
  };

  onRender = () => {
    console.log('onRender');
    this.setState({
      renderCounter: this.state.renderCounter + 1,
    });
  };

  get isVisible() {
    return !this.props.dashboard.otherPanelInFullscreen(this.props.panel);
  }

  render() {
    const { panel, dashboard } = this.props;
    const { refreshCounter, timeRange, timeInfo, renderCounter } = this.state;

    const { datasource, targets } = panel;
    const PanelComponent = this.props.component;

    console.log('panelChrome render');
    return (
      <div className="panel-container">
        <PanelHeader panel={panel} dashboard={dashboard} timeInfo={timeInfo} />
        <div className="panel-content">
          <DataPanel
            datasource={datasource}
            queries={targets}
            timeRange={timeRange}
            isVisible={this.isVisible}
            refreshCounter={refreshCounter}
          >
            {({ loading, timeSeries }) => {
              console.log('panelcrome inner render');
              return (
                <PanelComponent
                  loading={loading}
                  timeSeries={timeSeries}
                  timeRange={timeRange}
                  options={panel.getOptions()}
                  renderCounter={renderCounter}
                />
              );
            }}
          </DataPanel>
        </div>
      </div>
    );
  }
}
