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
import { TimeRange, LoadingState, PanelData, toLegacyResponseData } from '@grafana/ui';
import { ScopedVars } from '@grafana/ui';

import templateSrv from 'app/features/templating/template_srv';

import { PanelQueryRunner, PanelDataEvent } from '../state/PanelQueryRunner';
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
  data: PanelData;
}

export class PanelChrome extends PureComponent<Props, State> {
  timeSrv: TimeSrv = getTimeSrv();
  queryRunner = new PanelQueryRunner();
  querySubscription: Unsubscribable;
  queryWidthPixels = -1; // used to set maxDataPoints in query

  constructor(props: Props) {
    super(props);
    this.state = {
      refreshCounter: 0,
      renderCounter: 0,
      errorMessage: null,
      data: {
        state: LoadingState.NotStarted,
        series: [],
      },
    };

    // Listen for changes to the query results
    this.querySubscription = this.queryRunner.subscribe(this.panelDataObserver);
  }

  componentDidMount() {
    this.props.panel.events.on('refresh', this.onRefresh);
    this.props.panel.events.on('render', this.onRender);
    this.props.dashboard.panelInitialized(this.props.panel);
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onRefresh);
  }

  // Updates the response with information from the stream
  panelDataObserver = {
    next: (event: PanelDataEvent) => {
      const data = {
        ...this.state.data,
        ...event,
      };

      if (data.state === LoadingState.Error) {
        const { error } = data;
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

      // Save the query response into the panel
      if (data.state === LoadingState.Done && this.props.dashboard.snapshot) {
        this.props.panel.snapshotData = data.series;
      }

      this.setState({ data });

      // Notify query editors that the results have changed
      if (this.props.isEditing) {
        const events = this.props.panel.events;
        let legacy = data.legacy;
        if (!legacy) {
          legacy = data.series.map(v => toLegacyResponseData(v));
        }

        // Angular query editors expect TimeSeries|TableData
        events.emit('data-received', legacy);

        // Notify react query editors
        events.emit('series-data-received', data);
      }
    },
  };

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
      if (this.queryWidthPixels < 0) {
        console.log('No width yet... wait till we know');
        return;
      }
      this.queryRunner.run({
        datasource: panel.datasource,
        queries: panel.targets,
        panelId: panel.id,
        dashboardId: this.props.dashboard.id,
        timezone: this.props.dashboard.timezone,
        timeRange: timeData.timeRange,
        widthPixels: this.queryWidthPixels,
        minInterval: undefined, // Currently not passed in DataPanel?
        maxDataPoints: panel.maxDataPoints,
        scopedVars: panel.scopedVars,
        cacheTimeout: panel.cacheTimeout,
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
    const { timeRange, renderCounter, data } = this.state;
    const PanelComponent = plugin.reactPlugin.panel;

    // This is only done to increase a counter that is used by backend
    // image rendering (phantomjs/headless chrome) to know when to capture image
    const loading = data.state;
    if (loading === LoadingState.Done) {
      profiler.renderingCompleted(panel.id);
    }

    return (
      <>
        {loading === LoadingState.Loading && this.renderLoadingState()}
        <div className="panel-content">
          <PanelComponent
            data={data}
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
          if (this.queryWidthPixels < 0 && this.wantsQueryExecution) {
            this.queryWidthPixels = width;
            setTimeout(() => this.onRefresh(), 1); // TODO some better way!!!
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
