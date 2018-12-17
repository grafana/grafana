// Libraries
import React, { PureComponent } from 'react';
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
import { PanelPlugin, TimeRange } from 'app/types';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
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
    this.setState({
      renderCounter: this.state.renderCounter + 1,
    });
  };

  get isVisible() {
    return !this.props.dashboard.otherPanelInFullscreen(this.props.panel);
  }

  render() {
    const { panel, dashboard, plugin } = this.props;
    const { refreshCounter, timeRange, timeInfo, renderCounter } = this.state;

    const { datasource, targets, transparent } = panel;
    const PanelComponent = plugin.exports.Panel;
    const containerClassNames = `panel-container panel-container--absolute ${transparent ? 'panel-transparent' : ''}`;

    return (
      <AutoSizer>
        {({ width, height }) => {
          if (width === 0) {
            return null;
          }

          return (
            <div className={containerClassNames}>
              <PanelHeader
                panel={panel}
                dashboard={dashboard}
                timeInfo={timeInfo}
                title={panel.title}
                description={panel.description}
                scopedVars={panel.scopedVars}
                links={panel.links}
              />

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
                        options={panel.getOptions(plugin.exports.PanelDefaults)}
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
