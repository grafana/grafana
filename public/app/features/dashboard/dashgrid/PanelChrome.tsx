// Libraries
import React, { PureComponent } from 'react';
import { AutoSizer } from 'react-virtualized';

// Services
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';

// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import { DataPanel } from './DataPanel';
import ErrorBoundary from '../../../core/components/ErrorBoundary/ErrorBoundary';

// Utils
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { PANEL_HEADER_HEIGHT } from 'app/core/constants';
import { profiler } from 'app/core/profiler';
import config from 'app/core/config';

// Types
import { DashboardModel, PanelModel } from '../state';
import { PanelPlugin } from 'app/types';
import { DataQueryResponse, TimeRange, LoadingState, DataQueryError, SeriesData } from '@grafana/ui';
import { ScopedVars } from '@grafana/ui';

import templateSrv from 'app/features/templating/template_srv';

import { getProcessedSeriesData } from './DataPanel';

const DEFAULT_PLUGIN_ERROR = 'Error in plugin';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isFullscreen: boolean;
}

export interface State {
  refreshCounter: number;
  renderCounter: number;
  timeInfo?: string;
  timeRange?: TimeRange;
  errorMessage: string | null;
}

export class PanelChrome extends PureComponent<Props, State> {
  timeSrv: TimeSrv = getTimeSrv();

  constructor(props) {
    super(props);

    this.state = {
      refreshCounter: 0,
      renderCounter: 0,
      errorMessage: null,
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

  replaceVariables = (value: string, extraVars?: ScopedVars, format?: string) => {
    let vars = this.props.panel.scopedVars;
    if (extraVars) {
      vars = vars ? { ...vars, ...extraVars } : extraVars;
    }
    return templateSrv.replace(value, vars, format);
  };

  onDataResponse = (dataQueryResponse: DataQueryResponse) => {
    if (this.props.dashboard.isSnapshot()) {
      this.props.panel.snapshotData = dataQueryResponse.data;
    }
    // clear error state (if any)
    this.clearErrorState();

    // This event is used by old query editors and panel editor options
    this.props.panel.events.emit('data-received', dataQueryResponse.data);
  };

  onDataError = (message: string, error: DataQueryError) => {
    if (this.state.errorMessage !== message) {
      this.setState({ errorMessage: message });
    }
    // this event is used by old query editors
    this.props.panel.events.emit('data-error', error);
  };

  onPanelError = (message: string) => {
    if (this.state.errorMessage !== message) {
      this.setState({ errorMessage: message });
    }
  };

  clearErrorState() {
    if (this.state.errorMessage) {
      this.setState({ errorMessage: null });
    }
  }

  get isVisible() {
    return !this.props.dashboard.otherPanelInFullscreen(this.props.panel);
  }

  get hasPanelSnapshot() {
    const { panel } = this.props;
    return panel.snapshotData && panel.snapshotData.length;
  }

  get needsQueryExecution() {
    return this.hasPanelSnapshot || this.props.plugin.dataFormats.length > 0;
  }

  get getDataForPanel() {
    return this.hasPanelSnapshot ? getProcessedSeriesData(this.props.panel.snapshotData) : null;
  }

  renderPanelPlugin(loading: LoadingState, data: SeriesData[], width: number, height: number): JSX.Element {
    const { panel, plugin } = this.props;
    const { timeRange, renderCounter } = this.state;
    const PanelComponent = plugin.exports.reactPanel.panel;

    // This is only done to increase a counter that is used by backend
    // image rendering (phantomjs/headless chrome) to know when to capture image
    if (loading === LoadingState.Done) {
      profiler.renderingCompleted(panel.id);
    }

    return (
      <div className="panel-content">
        <PanelComponent
          loading={loading}
          data={data}
          timeRange={timeRange}
          options={panel.getOptions(plugin.exports.reactPanel.defaults)}
          width={width - 2 * config.theme.panelPadding.horizontal}
          height={height - PANEL_HEADER_HEIGHT - config.theme.panelPadding.vertical}
          renderCounter={renderCounter}
          replaceVariables={this.replaceVariables}
        />
      </div>
    );
  }

  renderPanelBody = (width: number, height: number): JSX.Element => {
    const { panel } = this.props;
    const { refreshCounter, timeRange } = this.state;
    const { datasource, targets } = panel;
    return (
      <>
        {this.needsQueryExecution ? (
          <DataPanel
            panelId={panel.id}
            datasource={datasource}
            queries={targets}
            timeRange={timeRange}
            isVisible={this.isVisible}
            widthPixels={width}
            refreshCounter={refreshCounter}
            scopedVars={panel.scopedVars}
            onDataResponse={this.onDataResponse}
            onError={this.onDataError}
          >
            {({ loading, data }) => {
              return this.renderPanelPlugin(loading, data, width, height);
            }}
          </DataPanel>
        ) : (
          this.renderPanelPlugin(LoadingState.Done, this.getDataForPanel, width, height)
        )}
      </>
    );
  };

  render() {
    const { dashboard, panel, isFullscreen } = this.props;
    const { errorMessage, timeInfo } = this.state;
    const { transparent } = panel;

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
                error={errorMessage}
                isFullscreen={isFullscreen}
              />
              <ErrorBoundary>
                {({ error, errorInfo }) => {
                  if (errorInfo) {
                    this.onPanelError(error.message || DEFAULT_PLUGIN_ERROR);
                    return null;
                  }
                  return this.renderPanelBody(width, height);
                }}
              </ErrorBoundary>
            </div>
          );
        }}
      </AutoSizer>
    );
  }
}
