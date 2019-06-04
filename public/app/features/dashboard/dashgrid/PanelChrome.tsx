// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { Unsubscribable } from 'rxjs';

// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import ErrorBoundary from 'app/core/components/ErrorBoundary/ErrorBoundary';

// Utils & Services
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { applyPanelTimeOverrides, calculateInnerPanelHeight } from 'app/features/dashboard/utils/panel';
import { profiler } from 'app/core/profiler';
import { getProcessedSeriesData } from '../state/PanelQueryState';
import templateSrv from 'app/features/templating/template_srv';
import config from 'app/core/config';

// Types
import { DashboardModel, PanelModel } from '../state';
import { LoadingState, PanelData, PanelPlugin } from '@grafana/ui';
import { ScopedVars } from '@grafana/ui';

const DEFAULT_PLUGIN_ERROR = 'Error in plugin';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isFullscreen: boolean;
  isInView: boolean;
  width: number;
  height: number;
}

export interface State {
  isFirstLoad: boolean;
  renderCounter: number;
  errorMessage: string | null;
  refreshWhenInView: boolean;

  // Current state of all events
  data: PanelData;
}

export class PanelChrome extends PureComponent<Props, State> {
  timeSrv: TimeSrv = getTimeSrv();
  querySubscription: Unsubscribable;

  constructor(props: Props) {
    super(props);
    this.state = {
      isFirstLoad: true,
      renderCounter: 0,
      errorMessage: null,
      refreshWhenInView: false,
      data: {
        state: LoadingState.NotStarted,
        series: [],
      },
    };
  }

  componentDidMount() {
    const { panel, dashboard } = this.props;
    panel.events.on('refresh', this.onRefresh);
    panel.events.on('render', this.onRender);
    dashboard.panelInitialized(this.props.panel);

    // Move snapshot data into the query response
    if (this.hasPanelSnapshot) {
      this.setState({
        data: {
          state: LoadingState.Done,
          series: getProcessedSeriesData(panel.snapshotData),
        },
        isFirstLoad: false,
      });
    } else if (!this.wantsQueryExecution) {
      this.setState({ isFirstLoad: false });
    }
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onRefresh);
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { isInView } = this.props;

    // View state has changed
    if (isInView !== prevProps.isInView) {
      if (isInView) {
        // Subscribe will kick of a notice of the last known state
        if (!this.querySubscription && this.wantsQueryExecution) {
          const runner = this.props.panel.getQueryRunner();
          this.querySubscription = runner.subscribe(this.panelDataObserver);
        }

        // Check if we need a delayed refresh
        if (this.state.refreshWhenInView) {
          this.onRefresh();
        }
      } else if (this.querySubscription) {
        this.querySubscription.unsubscribe();
        this.querySubscription = null;
      }
    }
  }

  // Updates the response with information from the stream
  // The next is outside a react synthetic event so setState is not batched
  // So in this context we can only do a single call to setState
  panelDataObserver = {
    next: (data: PanelData) => {
      if (!this.props.isInView) {
        // Ignore events when not visible.
        // The call will be repeated when the panel comes into view
        return;
      }

      let { errorMessage, isFirstLoad } = this.state;

      if (data.state === LoadingState.Error) {
        const { error } = data;
        if (error) {
          if (errorMessage !== error.message) {
            errorMessage = error.message;
          }
        }
      } else {
        errorMessage = null;
      }

      if (data.state === LoadingState.Done) {
        // If we are doing a snapshot save data in panel model
        if (this.props.dashboard.snapshot) {
          this.props.panel.snapshotData = data.series;
        }
        if (isFirstLoad) {
          isFirstLoad = false;
        }
      }

      this.setState({ isFirstLoad, errorMessage, data });
    },
  };

  onRefresh = () => {
    const { panel, isInView, width } = this.props;

    console.log('onRefresh', panel.id);

    if (!isInView) {
      console.log('Refresh when panel is visible', panel.id);
      this.setState({ refreshWhenInView: true });
      return;
    }

    const timeData = applyPanelTimeOverrides(panel, this.timeSrv.timeRange());

    // Issue Query
    if (this.wantsQueryExecution) {
      if (width < 0) {
        console.log('Refresh skippted, no width yet... wait till we know');
        return;
      }

      const queryRunner = panel.getQueryRunner();

      if (!this.querySubscription) {
        this.querySubscription = queryRunner.subscribe(this.panelDataObserver);
      }

      queryRunner.run({
        datasource: panel.datasource,
        queries: panel.targets,
        panelId: panel.id,
        dashboardId: this.props.dashboard.id,
        timezone: this.props.dashboard.timezone,
        timeRange: timeData.timeRange,
        timeInfo: timeData.timeInfo,
        widthPixels: width,
        maxDataPoints: panel.maxDataPoints,
        minInterval: panel.interval,
        scopedVars: panel.scopedVars,
        cacheTimeout: panel.cacheTimeout,
      });
    }
  };

  onRender = () => {
    const stateUpdate = { renderCounter: this.state.renderCounter + 1 };

    this.setState(stateUpdate);
  };

  onOptionsChange = (options: any) => {
    this.props.panel.updateOptions(options);
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

  get hasPanelSnapshot() {
    const { panel } = this.props;
    return panel.snapshotData && panel.snapshotData.length;
  }

  get wantsQueryExecution() {
    return !(this.props.plugin.meta.skipDataQuery || this.hasPanelSnapshot);
  }

  renderPanel(width: number, height: number): JSX.Element {
    const { panel, plugin } = this.props;
    const { renderCounter, data, isFirstLoad } = this.state;
    const { theme } = config;

    // This is only done to increase a counter that is used by backend
    // image rendering (phantomjs/headless chrome) to know when to capture image
    const loading = data.state;
    if (loading === LoadingState.Done) {
      profiler.renderingCompleted();
    }

    // do not render component until we have first data
    if (isFirstLoad && (loading === LoadingState.Loading || loading === LoadingState.NotStarted)) {
      return this.renderLoadingState();
    }

    const PanelComponent = plugin.panel;
    const innerPanelHeight = calculateInnerPanelHeight(panel, height);

    return (
      <>
        {loading === LoadingState.Loading && this.renderLoadingState()}
        <div className="panel-content">
          <PanelComponent
            id={panel.id}
            data={data}
            timeRange={data.request ? data.request.range : this.timeSrv.timeRange()}
            options={panel.getOptions()}
            transparent={panel.transparent}
            width={width - theme.panelPadding * 2}
            height={innerPanelHeight}
            renderCounter={renderCounter}
            replaceVariables={this.replaceVariables}
            onOptionsChange={this.onOptionsChange}
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
    const { dashboard, panel, isFullscreen, width, height } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': true,
      'panel-container--no-title': !panel.hasTitle(),
      'panel-transparent': transparent,
    });

    return (
      <div className={containerClassNames}>
        <PanelHeader
          panel={panel}
          dashboard={dashboard}
          timeInfo={data.request ? data.request.timeInfo : null}
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
  }
}
