// Libraries
import React, { ComponentClass, PureComponent } from 'react';
import { AutoSizer } from 'react-virtualized';

// Services
import { getTimeSrv, TimeSrv } from '../time_srv';

// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import { DataPanel } from './DataPanel';

// Utils
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { PANEL_HEADER_HEIGHT } from 'app/core/constants';

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
      <AutoSizer>
        {({ width, height }) => {
          if (width === 0) {
            return null;
          }

          return (
            <div className="panel-container panel-container--absolute">
              <PanelHeader panel={panel} dashboard={dashboard} timeInfo={timeInfo} />
              <DataPanel
                datasource={datasource}
                queries={targets}
                timeRange={timeRange}
                isVisible={this.isVisible}
                widthPixels={width}
                refreshCounter={refreshCounter}
              >
                {({ loading, timeSeries }) => {
                  return (
                    <div className="panel-content">
                      <PanelComponent
                        loading={loading}
                        timeSeries={timeSeries}
                        timeRange={timeRange}
                        options={panel.getOptions()}
                        width={width}
                        height={height - PANEL_HEADER_HEIGHT}
                        renderCounter={renderCounter}
                      />
                    </div>
                  );
                }}
              </DataPanel>
            </div>
          );
        }}
      </AutoSizer>
    );
  }
}
