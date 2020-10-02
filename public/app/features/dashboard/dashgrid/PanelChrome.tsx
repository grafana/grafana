// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { Unsubscribable } from 'rxjs';
// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import { ErrorBoundary } from '@grafana/ui';
// Utils & Services
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { profiler } from 'app/core/profiler';
import { getProcessedDataFrames } from '../state/runRequest';
import config from 'app/core/config';
import { updateLocation } from 'app/core/actions';
// Types
import { DashboardModel, PanelModel } from '../state';
import { PANEL_BORDER } from 'app/core/constants';
import {
  LoadingState,
  AbsoluteTimeRange,
  DefaultTimeRange,
  toUtc,
  toDataFrameDTO,
  PanelEvents,
  PanelData,
  PanelPlugin,
  FieldConfigSource,
  PanelPluginMeta,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

const DEFAULT_PLUGIN_ERROR = 'Error in plugin';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isViewing: boolean;
  isEditing: boolean;
  isInView: boolean;
  width: number;
  height: number;
  updateLocation: typeof updateLocation;
}

export interface State {
  isFirstLoad: boolean;
  renderCounter: number;
  errorMessage?: string;
  refreshWhenInView: boolean;
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
      refreshWhenInView: false,
      data: {
        state: LoadingState.NotStarted,
        series: [],
        timeRange: DefaultTimeRange,
      },
    };
  }

  componentDidMount() {
    const { panel, dashboard } = this.props;

    panel.events.on(PanelEvents.refresh, this.onRefresh);
    panel.events.on(PanelEvents.render, this.onRender);

    dashboard.panelInitialized(this.props.panel);

    // Move snapshot data into the query response
    if (this.hasPanelSnapshot) {
      this.setState({
        data: {
          ...this.state.data,
          state: LoadingState.Done,
          series: getProcessedDataFrames(panel.snapshotData),
        },
        isFirstLoad: false,
      });
      return;
    }

    if (!this.wantsQueryExecution) {
      this.setState({ isFirstLoad: false });
    }

    this.querySubscription = panel
      .getQueryRunner()
      .getData({ withTransforms: true, withFieldConfig: true })
      .subscribe({
        next: data => this.onDataUpdate(data),
      });
  }

  componentWillUnmount() {
    this.props.panel.events.off(PanelEvents.refresh, this.onRefresh);
    this.props.panel.events.off(PanelEvents.render, this.onRender);

    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { isInView } = this.props;

    // View state has changed
    if (isInView !== prevProps.isInView) {
      if (isInView) {
        // Check if we need a delayed refresh
        if (this.state.refreshWhenInView) {
          this.onRefresh();
        }
      }
    }
  }

  // Updates the response with information from the stream
  // The next is outside a react synthetic event so setState is not batched
  // So in this context we can only do a single call to setState
  onDataUpdate(data: PanelData) {
    if (!this.props.isInView) {
      // Ignore events when not visible.
      // The call will be repeated when the panel comes into view
      return;
    }

    let { isFirstLoad } = this.state;
    let errorMessage: string | undefined;

    switch (data.state) {
      case LoadingState.Loading:
        // Skip updating state data if it is already in loading state
        // This is to avoid rendering partial loading responses
        if (this.state.data.state === LoadingState.Loading) {
          return;
        }
        break;
      case LoadingState.Error:
        const { error } = data;
        if (error) {
          if (errorMessage !== error.message) {
            errorMessage = error.message;
          }
        }
        break;
      case LoadingState.Done:
        // If we are doing a snapshot save data in panel model
        if (this.props.dashboard.snapshot) {
          this.props.panel.snapshotData = data.series.map(frame => toDataFrameDTO(frame));
        }
        if (isFirstLoad) {
          isFirstLoad = false;
        }
        break;
    }

    this.setState({ isFirstLoad, errorMessage, data });
  }

  onRefresh = () => {
    const { panel, isInView, width } = this.props;
    if (!isInView) {
      this.setState({ refreshWhenInView: true });
      return;
    }

    const timeData = applyPanelTimeOverrides(panel, this.timeSrv.timeRange());

    // Issue Query
    if (this.wantsQueryExecution) {
      if (width < 0) {
        return;
      }

      panel.getQueryRunner().run({
        datasource: panel.datasource,
        queries: panel.targets,
        panelId: panel.id,
        dashboardId: this.props.dashboard.id,
        timezone: this.props.dashboard.getTimezone(),
        timeRange: timeData.timeRange,
        timeInfo: timeData.timeInfo,
        maxDataPoints: panel.maxDataPoints || width,
        minInterval: panel.interval,
        scopedVars: panel.scopedVars,
        cacheTimeout: panel.cacheTimeout,
        transformations: panel.transformations,
      });
    } else {
      // The panel should render on refresh as well if it doesn't have a query, like clock panel
      this.onRender();
    }
  };

  onRender = () => {
    const stateUpdate = { renderCounter: this.state.renderCounter + 1 };
    this.setState(stateUpdate);
  };

  onOptionsChange = (options: any) => {
    this.props.panel.updateOptions(options);
  };

  onFieldConfigChange = (config: FieldConfigSource) => {
    this.props.panel.updateFieldConfig(config);
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

  onChangeTimeRange = (timeRange: AbsoluteTimeRange) => {
    this.timeSrv.setTime({
      from: toUtc(timeRange.from),
      to: toUtc(timeRange.to),
    });
  };

  shouldSignalRenderingCompleted(loadingState: LoadingState, pluginMeta: PanelPluginMeta) {
    return loadingState === LoadingState.Done || pluginMeta.skipDataQuery;
  }

  renderPanel(width: number, height: number) {
    const { panel, plugin } = this.props;
    const { renderCounter, data, isFirstLoad } = this.state;
    const { theme } = config;
    const { state: loadingState } = data;

    // do not render component until we have first data
    if (isFirstLoad && (loadingState === LoadingState.Loading || loadingState === LoadingState.NotStarted)) {
      return null;
    }

    // This is only done to increase a counter that is used by backend
    // image rendering to know when to capture image
    if (this.shouldSignalRenderingCompleted(loadingState, plugin.meta)) {
      profiler.renderingCompleted();
    }

    const PanelComponent = plugin.panel!;
    const timeRange = data.timeRange || this.timeSrv.timeRange();
    const headerHeight = this.hasOverlayHeader() ? 0 : theme.panelHeaderHeight;
    const chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
    const panelWidth = width - chromePadding * 2 - PANEL_BORDER;
    const innerPanelHeight = height - headerHeight - chromePadding * 2 - PANEL_BORDER;
    const panelContentClassNames = classNames({
      'panel-content': true,
      'panel-content--no-padding': plugin.noPadding,
    });
    const panelOptions = panel.getOptions();

    return (
      <>
        <div className={panelContentClassNames}>
          <PanelComponent
            id={panel.id}
            data={data}
            title={panel.title}
            timeRange={timeRange}
            timeZone={this.props.dashboard.getTimezone()}
            options={panelOptions}
            fieldConfig={panel.fieldConfig}
            transparent={panel.transparent}
            width={panelWidth}
            height={innerPanelHeight}
            renderCounter={renderCounter}
            replaceVariables={panel.replaceVariables}
            onOptionsChange={this.onOptionsChange}
            onFieldConfigChange={this.onFieldConfigChange}
            onChangeTimeRange={this.onChangeTimeRange}
          />
        </div>
      </>
    );
  }

  hasOverlayHeader() {
    const { panel } = this.props;
    const { errorMessage, data } = this.state;

    // always show normal header if we have an error message
    if (errorMessage) {
      return false;
    }

    // always show normal header if we have time override
    if (data.request && data.request.timeInfo) {
      return false;
    }

    return !panel.hasTitle();
  }

  render() {
    const { dashboard, panel, isViewing, isEditing, width, height, updateLocation } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': true,
      'panel-container--transparent': transparent,
      'panel-container--no-title': this.hasOverlayHeader(),
    });

    return (
      <div className={containerClassNames} aria-label={selectors.components.Panels.Panel.containerByTitle(panel.title)}>
        <PanelHeader
          panel={panel}
          dashboard={dashboard}
          title={panel.title}
          description={panel.description}
          scopedVars={panel.scopedVars}
          links={panel.links}
          error={errorMessage}
          isEditing={isEditing}
          isViewing={isViewing}
          data={data}
          updateLocation={updateLocation}
        />
        <ErrorBoundary>
          {({ error }) => {
            if (error) {
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
