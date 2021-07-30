// Libraries
import React, { Component } from 'react';
import classNames from 'classnames';
import { Subscription } from 'rxjs';
// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import { ErrorBoundary, PanelContextProvider, PanelContext, SeriesVisibilityChangeMode } from '@grafana/ui';
// Utils & Services
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { profiler } from 'app/core/profiler';
import config from 'app/core/config';
// Types
import { DashboardModel, PanelModel } from '../state';
import { PANEL_BORDER } from 'app/core/constants';
import {
  AbsoluteTimeRange,
  AnnotationChangeEvent,
  AnnotationEventUIModel,
  DashboardCursorSync,
  EventFilterOptions,
  FieldConfigSource,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  PanelPlugin,
  PanelPluginMeta,
  toDataFrameDTO,
  toUtc,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { loadSnapshotData } from '../utils/loadSnapshotData';
import { RefreshEvent, RenderEvent } from 'app/types/events';
import { changeSeriesColorConfigFactory } from 'app/plugins/panel/timeseries/overrides/colorSeriesConfigFactory';
import { seriesVisibilityConfigFactory } from './SeriesVisibilityConfigFactory';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from '../../annotations/api';
import { getDashboardQueryRunner } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';

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
}

export interface State {
  isFirstLoad: boolean;
  renderCounter: number;
  errorMessage?: string;
  refreshWhenInView: boolean;
  context: PanelContext;
  data: PanelData;
}

export class PanelChrome extends Component<Props, State> {
  private readonly timeSrv: TimeSrv = getTimeSrv();
  private subs = new Subscription();
  private eventFilter: EventFilterOptions = { onlyLocal: true };

  constructor(props: Props) {
    super(props);

    // Can this eventBus be on PanelModel?  when we have more complex event filtering, that may be a better option
    const eventBus = props.dashboard.events.newScopedBus(`panel:${props.panel.id}`, this.eventFilter);

    this.state = {
      isFirstLoad: true,
      renderCounter: 0,
      refreshWhenInView: false,
      context: {
        sync: props.isEditing ? DashboardCursorSync.Off : props.dashboard.graphTooltip,
        eventBus,
        onSeriesColorChange: this.onSeriesColorChange,
        onToggleSeriesVisibility: this.onSeriesVisibilityChange,
        onAnnotationCreate: this.onAnnotationCreate,
        onAnnotationUpdate: this.onAnnotationUpdate,
        onAnnotationDelete: this.onAnnotationDelete,
        canAddAnnotations: () => Boolean(props.dashboard.meta.canEdit || props.dashboard.meta.canMakeEditable),
      },
      data: this.getInitialPanelDataState(),
    };
  }

  onSeriesColorChange = (label: string, color: string) => {
    this.onFieldConfigChange(changeSeriesColorConfigFactory(label, color, this.props.panel.fieldConfig));
  };

  onSeriesVisibilityChange = (label: string, mode: SeriesVisibilityChangeMode) => {
    this.onFieldConfigChange(
      seriesVisibilityConfigFactory(label, mode, this.props.panel.fieldConfig, this.state.data.series)
    );
  };

  getInitialPanelDataState(): PanelData {
    return {
      state: LoadingState.NotStarted,
      series: [],
      timeRange: getDefaultTimeRange(),
    };
  }

  componentDidMount() {
    const { panel, dashboard } = this.props;

    // Subscribe to panel events
    this.subs.add(panel.events.subscribe(RefreshEvent, this.onRefresh));
    this.subs.add(panel.events.subscribe(RenderEvent, this.onRender));

    dashboard.panelInitialized(this.props.panel);

    // Move snapshot data into the query response
    if (this.hasPanelSnapshot) {
      this.setState({
        data: loadSnapshotData(panel, dashboard),
        isFirstLoad: false,
      });
      return;
    }

    if (!this.wantsQueryExecution) {
      this.setState({ isFirstLoad: false });
    }

    this.subs.add(
      panel
        .getQueryRunner()
        .getData({ withTransforms: true, withFieldConfig: true })
        .subscribe({
          next: (data) => this.onDataUpdate(data),
        })
    );
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
  }

  componentDidUpdate(prevProps: Props) {
    const { isInView, isEditing } = this.props;

    if (prevProps.dashboard.graphTooltip !== this.props.dashboard.graphTooltip) {
      this.setState((s) => {
        return {
          context: { ...s.context, sync: isEditing ? DashboardCursorSync.Off : this.props.dashboard.graphTooltip },
        };
      });
    }

    if (isEditing !== prevProps.isEditing) {
      this.setState((s) => {
        return {
          context: { ...s.context, sync: isEditing ? DashboardCursorSync.Off : this.props.dashboard.graphTooltip },
        };
      });
    }

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

  shouldComponentUpdate(prevProps: Props, prevState: State) {
    const { plugin, panel } = this.props;

    // If plugin changed we need to process fieldOverrides again
    // We do this by asking panel query runner to resend last result
    if (prevProps.plugin !== plugin) {
      panel.getQueryRunner().resendLastResult();
      return false;
    }

    return true;
  }

  // Updates the response with information from the stream
  // The next is outside a react synthetic event so setState is not batched
  // So in this context we can only do a single call to setState
  onDataUpdate(data: PanelData) {
    const { dashboard, panel, plugin } = this.props;

    // Ignore this data update if we are now a non data panel
    if (plugin.meta.skipDataQuery) {
      this.setState({ data: this.getInitialPanelDataState() });
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
        if (dashboard.snapshot) {
          panel.snapshotData = data.series.map((frame) => toDataFrameDTO(frame));
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

      if (this.state.refreshWhenInView) {
        this.setState({ refreshWhenInView: false });
      }
      panel.runAllPanelQueries(this.props.dashboard.id, this.props.dashboard.getTimezone(), timeData, width);
    } else {
      // The panel should render on refresh as well if it doesn't have a query, like clock panel
      this.setState({
        data: { ...this.state.data, timeRange: this.timeSrv.timeRange() },
        renderCounter: this.state.renderCounter + 1,
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

  onFieldConfigChange = (config: FieldConfigSource) => {
    this.props.panel.updateFieldConfig(config);
  };

  onPanelError = (message: string) => {
    if (this.state.errorMessage !== message) {
      this.setState({ errorMessage: message });
    }
  };

  onAnnotationCreate = async (event: AnnotationEventUIModel) => {
    const isRegion = event.from !== event.to;
    const anno = {
      dashboardId: this.props.dashboard.id,
      panelId: this.props.panel.id,
      isRegion,
      time: event.from,
      timeEnd: isRegion ? event.to : 0,
      tags: event.tags,
      text: event.description,
    };
    await saveAnnotation(anno);
    getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
    this.state.context.eventBus.publish(new AnnotationChangeEvent(anno));
  };

  onAnnotationDelete = async (id: string) => {
    await deleteAnnotation({ id });
    getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
    this.state.context.eventBus.publish(new AnnotationChangeEvent({ id }));
  };

  onAnnotationUpdate = async (event: AnnotationEventUIModel) => {
    const isRegion = event.from !== event.to;
    const anno = {
      id: event.id,
      dashboardId: this.props.dashboard.id,
      panelId: this.props.panel.id,
      isRegion,
      time: event.from,
      timeEnd: isRegion ? event.to : 0,
      tags: event.tags,
      text: event.description,
    };
    await updateAnnotation(anno);

    getDashboardQueryRunner().run({ dashboard: this.props.dashboard, range: this.timeSrv.timeRange() });
    this.state.context.eventBus.publish(new AnnotationChangeEvent(anno));
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

  skipFirstRender(loadingState: LoadingState) {
    const { isFirstLoad } = this.state;
    return (
      this.wantsQueryExecution &&
      isFirstLoad &&
      (loadingState === LoadingState.Loading || loadingState === LoadingState.NotStarted)
    );
  }

  renderPanel(width: number, height: number) {
    const { panel, plugin, dashboard } = this.props;
    const { renderCounter, data } = this.state;
    const { theme } = config;
    const { state: loadingState } = data;

    // do not render component until we have first data
    if (this.skipFirstRender(loadingState)) {
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

    // Update the event filter (dashboard settings may have changed)
    // Yes this is called ever render for a function that is triggered on every mouse move
    this.eventFilter.onlyLocal = dashboard.graphTooltip === 0;

    return (
      <>
        <div className={panelContentClassNames}>
          <PanelContextProvider value={this.state.context}>
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
              eventBus={dashboard.events}
            />
          </PanelContextProvider>
        </div>
      </>
    );
  }

  hasOverlayHeader() {
    const { panel } = this.props;
    const { data } = this.state;

    // always show normal header if we have time override
    if (data.request && data.request.timeInfo) {
      return false;
    }

    return !panel.hasTitle();
  }

  render() {
    const { dashboard, panel, isViewing, isEditing, width, height } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    let alertState = config.featureToggles.ngalert ? undefined : data.alertState?.state;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': true,
      'panel-container--transparent': transparent,
      'panel-container--no-title': this.hasOverlayHeader(),
      [`panel-alert-state--${alertState}`]: alertState !== undefined,
    });

    return (
      <section
        className={containerClassNames}
        aria-label={selectors.components.Panels.Panel.containerByTitle(panel.title)}
      >
        <PanelHeader
          panel={panel}
          dashboard={dashboard}
          title={panel.title}
          description={panel.description}
          links={panel.links}
          error={errorMessage}
          isEditing={isEditing}
          isViewing={isViewing}
          alertState={alertState}
          data={data}
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
      </section>
    );
  }
}
