// Libraries
import React, { PureComponent } from 'react';
import { AutoSizer } from 'react-virtualized';

// Services
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';

// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import ErrorBoundary from '../../../core/components/ErrorBoundary/ErrorBoundary';

// Utils
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { PANEL_HEADER_HEIGHT } from 'app/core/constants';
import { profiler } from 'app/core/profiler';
import config from 'app/core/config';

// Types
import { DashboardModel, PanelModel } from '../state';
import { PanelPlugin } from 'app/types';
import { TimeRange, LoadingState, toLegacyResponseData, QueryResponseData } from '@grafana/ui';
import { ScopedVars } from '@grafana/ui';

import templateSrv from 'app/features/templating/template_srv';

import { getProcessedSeriesData, PanelQueryRunner, QueryResponseEvent } from './PanelQueryRunner';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { Unsubscribable } from 'rxjs';

const DEFAULT_PLUGIN_ERROR = 'Error in plugin';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isFullscreen: boolean;
  isEditing: boolean;
}

export interface State {
  refreshCounter: number;
  renderCounter: number;
  timeInfo?: string;
  timeRange?: TimeRange;
  errorMessage: string | null;

  // Current state of all events
  response: QueryResponseData;
}

export class PanelChrome extends PureComponent<Props, State> {
  timeSrv: TimeSrv = getTimeSrv();
  queryRunner = new PanelQueryRunner(getDatasourceSrv());
  querySubscription: Unsubscribable;
  queryWidthPixels = 100; // Default value for width

  constructor(props: Props) {
    super(props);

    this.state = {
      refreshCounter: 0,
      renderCounter: 0,
      errorMessage: null,
      response: {
        loading: LoadingState.NotStarted,
        data: [],
        annotations: [],
      },
    };

    // Currently all internal to this component, but eventually can be external
    this.querySubscription = this.queryRunner.subscribe(this.queryResponseListener);
  }

  // Updates the response with information from the stream
  queryResponseListener = (event: QueryResponseEvent) => {
    let { response } = this.state;
    this.setState({
      response: {
        ...response,
        ...event,
      },
    });

    response = this.state.response;
    if (response.loading === LoadingState.Error) {
      const { error } = response;
      if (error) {
        if (this.state.errorMessage !== error.message) {
          this.setState({ errorMessage: error.message });
        }
        // this event is used by old query editors
        this.props.panel.events.emit('data-error', error);
      }
    } else {
      this.clearErrorState();
    }

    if (this.props.isEditing && response.loading !== LoadingState.Loading) {
      const events = this.props.panel.events;

      const data = response.data ? response.data : [];
      const legacy = response.legacy ? response.legacy : data.map(v => toLegacyResponseData(v));

      // Angular query editors expect TimeSeries|TableData
      events.emit('data-received', legacy);

      // Notify react query editors
      events.emit('series-data-received', data);
    }

    // Save the query response into the panel
    if (response.data && this.props.dashboard.snapshot) {
      this.props.panel.snapshotData = response.data;
    }
  };

  componentDidMount() {
    this.props.panel.events.on('refresh', this.onRefresh);
    this.props.panel.events.on('render', this.onRender);
    this.props.dashboard.panelInitialized(this.props.panel);
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onRefresh);
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { panel } = this.props;

    // Check if we have snapshot data and pretend it came from a query
    if (panel.snapshotData && panel.snapshotData !== prevProps.panel.snapshotData && panel.snapshotData.length) {
      console.log('Set panel data from snapshot', panel);
      this.setState({
        response: {
          data: getProcessedSeriesData(panel.snapshotData),
          loading: LoadingState.Done,
          annotations: [],
        },
      });
    }
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

    // Issue Query
    if (this.wantsQueryExecution && !this.hasPanelSnapshot) {
      this.queryRunner.run({
        datasource: panel.datasource,
        queries: panel.targets,
        panelId: panel.id,
        dashboardId: this.props.dashboard.id,
        timeRange: timeData.timeRange,
        widthPixels: this.queryWidthPixels,
        minInterval: undefined, // Currently not passed in DataPanel
        maxDataPoints: panel.maxDataPoints,
        scopedVars: panel.scopedVars,
      });
    }
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

  get wantsQueryExecution() {
    return this.props.plugin.dataFormats.length > 0;
  }

  renderPanel(width: number, height: number): JSX.Element {
    const { panel, plugin } = this.props;
    const { timeRange, renderCounter, response } = this.state;
    const PanelComponent = plugin.reactPlugin.panel;

    // This is only done to increase a counter that is used by backend
    // image rendering (phantomjs/headless chrome) to know when to capture image
    const { loading } = response;
    if (loading === LoadingState.Done) {
      profiler.renderingCompleted(panel.id);
    }

    return (
      <>
        {loading === LoadingState.Loading && this.renderLoadingState()}
        <div className="panel-content">
          <PanelComponent
            {...response}
            timeRange={timeRange}
            options={panel.getOptions(plugin.reactPlugin.defaults)}
            width={width - 2 * config.theme.panelPadding.horizontal}
            height={height - PANEL_HEADER_HEIGHT - config.theme.panelPadding.vertical}
            renderCounter={renderCounter}
            replaceVariables={this.replaceVariables}
          />
        </div>
      </>
    );
  }

  private renderLoadingState(): JSX.Element {
    return (
      <div className="panel-loading">
        <i className="fa fa-spinner fa-spin" />
      </div>
    );
  }

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
          this.queryWidthPixels = width;

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
                  return this.renderPanel(width, height);
                }}
              </ErrorBoundary>
            </div>
          );
        }}
      </AutoSizer>
    );
  }
}
