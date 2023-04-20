import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';

import {
  AbsoluteTimeRange,
  AnnotationChangeEvent,
  AnnotationEventUIModel,
  CoreApp,
  DashboardCursorSync,
  DataFrame,
  DataFrameJSON,
  dataFrameToJSON,
  EventFilterOptions,
  FieldConfigSource,
  getDataSourceRef,
  getDefaultTimeRange,
  LinkModel,
  LoadingState,
  PanelData,
  PanelPlugin,
  PanelPluginMeta,
  PluginContextProvider,
  renderMarkdown,
  TimeRange,
  toDataFrameDTO,
  toUtc,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv, config, locationService, RefreshEvent, reportInteraction } from '@grafana/runtime';
import { DataQuery, VizLegendOptions } from '@grafana/schema';
import {
  ErrorBoundary,
  PanelChrome,
  PanelContext,
  PanelContextProvider,
  PanelPadding,
  SeriesVisibilityChangeMode,
  AdHocFilterItem,
} from '@grafana/ui';
import { PANEL_BORDER } from 'app/core/constants';
import { profiler } from 'app/core/profiler';
import { GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { applyFilterFromTable } from 'app/features/variables/adhoc/actions';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { changeSeriesColorConfigFactory } from 'app/plugins/panel/timeseries/overrides/colorSeriesConfigFactory';
import { dispatch } from 'app/store/store';
import { RenderEvent } from 'app/types/events';

import { isSoloRoute } from '../../../routes/utils';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from '../../annotations/api';
import { getDashboardQueryRunner } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { DashboardModel, PanelModel } from '../state';
import { loadSnapshotData } from '../utils/loadSnapshotData';

import { PanelHeader } from './PanelHeader/PanelHeader';
import { PanelHeaderMenuWrapperNew } from './PanelHeader/PanelHeaderMenuWrapper';
import { PanelHeaderTitleItems } from './PanelHeader/PanelHeaderTitleItems';
import { seriesVisibilityConfigFactory } from './SeriesVisibilityConfigFactory';
import { liveTimer } from './liveTimer';

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
  onInstanceStateChange: (value: any) => void;
  timezone?: string;
  hideMenu?: boolean;
}

export interface State {
  isFirstLoad: boolean;
  renderCounter: number;
  errorMessage?: string;
  refreshWhenInView: boolean;
  context: PanelContext;
  data: PanelData;
  liveTime?: TimeRange;
}

export class PanelStateWrapper extends PureComponent<Props, State> {
  private readonly timeSrv: TimeSrv = getTimeSrv();
  private subs = new Subscription();
  private eventFilter: EventFilterOptions = { onlyLocal: true };
  private descriptionInteractionReported = false;

  constructor(props: Props) {
    super(props);

    // Can this eventBus be on PanelModel?  when we have more complex event filtering, that may be a better option
    const eventBus = props.dashboard.events.newScopedBus(`panel:${props.panel.id}`, this.eventFilter);

    this.state = {
      isFirstLoad: true,
      renderCounter: 0,
      refreshWhenInView: false,
      context: {
        eventBus,
        app: this.getPanelContextApp(),
        sync: this.getSync,
        onSeriesColorChange: this.onSeriesColorChange,
        onToggleSeriesVisibility: this.onSeriesVisibilityChange,
        onAnnotationCreate: this.onAnnotationCreate,
        onAnnotationUpdate: this.onAnnotationUpdate,
        onAnnotationDelete: this.onAnnotationDelete,
        onInstanceStateChange: this.onInstanceStateChange,
        onToggleLegendSort: this.onToggleLegendSort,
        canAddAnnotations: props.dashboard.canAddAnnotations.bind(props.dashboard),
        canEditAnnotations: props.dashboard.canEditAnnotations.bind(props.dashboard),
        canDeleteAnnotations: props.dashboard.canDeleteAnnotations.bind(props.dashboard),
        onAddAdHocFilter: this.onAddAdHocFilter,
        onUpdateQueries: this.onUpdateQueries,
        onUpdateData: this.onUpdateData,
      },
      data: this.getInitialPanelDataState(),
    };
  }

  // Due to a mutable panel model we get the sync settings via function that proactively reads from the model
  getSync = () => (this.props.isEditing ? DashboardCursorSync.Off : this.props.dashboard.graphTooltip);

  onInstanceStateChange = (value: any) => {
    this.props.onInstanceStateChange(value);

    this.setState({
      context: {
        ...this.state.context,
        instanceState: value,
      },
    });
  };

  getPanelContextApp() {
    if (this.props.isEditing) {
      return CoreApp.PanelEditor;
    }
    if (this.props.isViewing) {
      return CoreApp.PanelViewer;
    }

    return CoreApp.Dashboard;
  }

  onUpdateData = (frames: DataFrame[]) => {
    const snapshot: DataFrameJSON[] = frames.map((f) => dataFrameToJSON(f));
    const query: GrafanaQuery = {
      refId: 'A',
      queryType: GrafanaQueryType.Snapshot,
      snapshot,
      datasource: { uid: GRAFANA_DATASOURCE_NAME },
    };

    this.props.panel.updateQueries({
      dataSource: { uid: GRAFANA_DATASOURCE_NAME },
      queries: [query],
    });
  };

  onUpdateQueries = (queries: DataQuery[]) => {
    const { panel } = this.props;

    if (!queries.length) {
      return;
    }

    const ds = queries[0].datasource;
    panel.updateQueries({
      dataSource: ds!,
      queries,
    });
  };

  onSeriesColorChange = (label: string, color: string) => {
    this.onFieldConfigChange(changeSeriesColorConfigFactory(label, color, this.props.panel.fieldConfig));
  };

  onSeriesVisibilityChange = (label: string, mode: SeriesVisibilityChangeMode) => {
    this.onFieldConfigChange(
      seriesVisibilityConfigFactory(label, mode, this.props.panel.fieldConfig, this.state.data.series)
    );
  };

  onToggleLegendSort = (sortKey: string) => {
    const legendOptions: VizLegendOptions = this.props.panel.options.legend;

    // We don't want to do anything when legend options are not available
    if (!legendOptions) {
      return;
    }

    let sortDesc = legendOptions.sortDesc;
    let sortBy = legendOptions.sortBy;
    if (sortKey !== sortBy) {
      sortDesc = undefined;
    }

    // if already sort ascending, disable sorting
    if (sortDesc === false) {
      sortBy = undefined;
      sortDesc = undefined;
    } else {
      sortDesc = !sortDesc;
      sortBy = sortKey;
    }

    this.onOptionsChange({
      ...this.props.panel.options,
      legend: { ...legendOptions, sortBy, sortDesc },
    });
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

    // Listen for live timer events
    liveTimer.listen(this);
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
    liveTimer.remove(this);
  }

  liveTimeChanged(liveTime: TimeRange) {
    const { data } = this.state;
    if (data.timeRange) {
      const delta = liveTime.to.valueOf() - data.timeRange.to.valueOf();
      if (delta < 100) {
        // 10hz
        console.log('Skip tick render', this.props.panel.title, delta);
        return;
      }
    }
    this.setState({ liveTime });
  }

  componentDidUpdate(prevProps: Props) {
    const { isInView, width } = this.props;
    const { context } = this.state;

    const app = this.getPanelContextApp();

    if (context.app !== app) {
      this.setState({
        context: {
          ...context,
          app,
        },
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

    // The timer depends on panel width
    if (width !== prevProps.width) {
      liveTimer.updateInterval(this);
    }
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
        const { error, errors } = data;
        if (errors?.length) {
          if (errors.length === 1) {
            errorMessage = errors[0].message;
          } else {
            errorMessage = 'Multiple errors found. Click for more details';
          }
        } else if (error) {
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

    this.setState({ isFirstLoad, errorMessage, data, liveTime: undefined });
  }

  onRefresh = () => {
    const { dashboard, panel, isInView, width } = this.props;

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
      panel.runAllPanelQueries({
        dashboardUID: dashboard.uid,
        dashboardTimezone: dashboard.getTimezone(),
        publicDashboardAccessToken: dashboard.meta.publicDashboardAccessToken,
        timeData,
        width,
      });
    } else {
      // The panel should render on refresh as well if it doesn't have a query, like clock panel
      this.setState({
        data: { ...this.state.data, timeRange: this.timeSrv.timeRange() },
        renderCounter: this.state.renderCounter + 1,
        liveTime: undefined,
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

  onPanelError = (error: Error) => {
    const errorMessage = error.message || DEFAULT_PLUGIN_ERROR;
    if (this.state.errorMessage !== errorMessage) {
      this.setState({ errorMessage });
    }
  };

  onPanelErrorRecover = () => {
    this.setState({ errorMessage: undefined });
  };

  onAnnotationCreate = async (event: AnnotationEventUIModel) => {
    const isRegion = event.from !== event.to;
    const anno = {
      dashboardUID: this.props.dashboard.uid,
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
      dashboardUID: this.props.dashboard.uid,
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

  onAddAdHocFilter = (filter: AdHocFilterItem) => {
    const { key, value, operator } = filter;

    // When the datasource is null/undefined (for a default datasource), we use getInstanceSettings
    // to find the real datasource ref for the default datasource.
    const datasourceInstance = getDatasourceSrv().getInstanceSettings(this.props.panel.datasource);
    const datasourceRef = datasourceInstance && getDataSourceRef(datasourceInstance);
    if (!datasourceRef) {
      return;
    }

    dispatch(applyFilterFromTable({ datasource: datasourceRef, key, operator, value }));
  };

  renderPanelContent(innerWidth: number, innerHeight: number) {
    const { panel, plugin, dashboard } = this.props;
    const { renderCounter, data } = this.state;
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
    const timeRange = this.state.liveTime ?? data.timeRange ?? this.timeSrv.timeRange();
    const panelOptions = panel.getOptions();

    // Update the event filter (dashboard settings may have changed)
    // Yes this is called ever render for a function that is triggered on every mouse move
    this.eventFilter.onlyLocal = dashboard.graphTooltip === 0;

    return (
      <>
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
            width={innerWidth}
            height={innerHeight}
            renderCounter={renderCounter}
            replaceVariables={panel.replaceVariables}
            onOptionsChange={this.onOptionsChange}
            onFieldConfigChange={this.onFieldConfigChange}
            onChangeTimeRange={this.onChangeTimeRange}
            eventBus={dashboard.events}
          />
        </PanelContextProvider>
      </>
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
    const timeRange = this.state.liveTime ?? data.timeRange ?? this.timeSrv.timeRange();
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

    const timeZone = this.props.timezone || this.props.dashboard.getTimezone();

    return (
      <>
        <div className={panelContentClassNames}>
          <PluginContextProvider meta={plugin.meta}>
            <PanelContextProvider value={this.state.context}>
              <PanelComponent
                id={panel.id}
                data={data}
                title={panel.title}
                timeRange={timeRange}
                timeZone={timeZone}
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
          </PluginContextProvider>
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

  onShowPanelDescription = () => {
    const { panel } = this.props;
    const descriptionMarkdown = getTemplateSrv().replace(panel.description, panel.scopedVars);
    const interpolatedDescription = renderMarkdown(descriptionMarkdown);

    if (!this.descriptionInteractionReported) {
      // Description rendering function can be called multiple times due to re-renders but we want to report the interaction once.
      reportInteraction('dashboards_panelheader_description_displayed');
      this.descriptionInteractionReported = true;
    }

    return interpolatedDescription;
  };

  onShowPanelLinks = (): LinkModel[] => {
    const { panel } = this.props;
    const linkSupplier = getPanelLinksSupplier(panel);
    if (linkSupplier) {
      const panelLinks = linkSupplier && linkSupplier.getLinks(panel.replaceVariables);

      return panelLinks.map((panelLink) => ({
        ...panelLink,
        onClick: (...args) => {
          reportInteraction('dashboards_panelheader_datalink_clicked', { has_multiple_links: panelLinks.length > 1 });
          panelLink.onClick?.(...args);
        },
      }));
    }
    return [];
  };

  onOpenInspector = (e: React.SyntheticEvent, tab: string) => {
    e.stopPropagation();
    locationService.partial({ inspect: this.props.panel.id, inspectTab: tab });
  };

  onOpenErrorInspect = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    locationService.partial({ inspect: this.props.panel.id, inspectTab: InspectTab.Error });
    reportInteraction('dashboards_panelheader_statusmessage_clicked');
  };

  onCancelQuery = () => {
    this.props.panel.getQueryRunner().cancelQuery();
    reportInteraction('dashboards_panelheader_cancelquery_clicked', { data_state: this.state.data.state });
  };

  render() {
    const { dashboard, panel, isViewing, isEditing, width, height, plugin } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    const alertState = data.alertState?.state;
    const hasHoverHeader = this.hasOverlayHeader();

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': isSoloRoute(locationService.getLocation().pathname),
      'panel-container--transparent': transparent,
      'panel-container--no-title': hasHoverHeader,
      [`panel-alert-state--${alertState}`]: alertState !== undefined,
    });

    const title = panel.getDisplayTitle();
    const padding: PanelPadding = plugin.noPadding ? 'none' : 'md';

    const showTitleItems =
      (panel.links && panel.links.length > 0 && this.onShowPanelLinks) ||
      (data.series.length > 0 && data.series.some((v) => (v.meta?.notices?.length ?? 0) > 0)) ||
      (data.request && data.request.timeInfo) ||
      alertState;

    const titleItems = showTitleItems && (
      <PanelHeaderTitleItems
        key="title-items"
        alertState={alertState}
        data={data}
        panelId={panel.id}
        panelLinks={panel.links}
        onShowPanelLinks={this.onShowPanelLinks}
      />
    );

    const dragClass = !(isViewing || isEditing) ? 'grid-drag-handle' : '';
    if (config.featureToggles.newPanelChromeUI) {
      // Shift the hover menu down if it's on the top row so it doesn't get clipped by topnav
      const hoverHeaderOffset = (panel.gridPos?.y ?? 0) === 0 ? -16 : undefined;

      const menu = (
        <div data-testid="panel-dropdown">
          <PanelHeaderMenuWrapperNew panel={panel} dashboard={dashboard} loadingState={data.state} />
        </div>
      );

      return (
        <PanelChrome
          width={width}
          height={height}
          title={title}
          loadingState={data.state}
          statusMessage={errorMessage}
          statusMessageOnClick={this.onOpenErrorInspect}
          description={!!panel.description ? this.onShowPanelDescription : undefined}
          titleItems={titleItems}
          menu={this.props.hideMenu ? undefined : menu}
          dragClass={dragClass}
          dragClassCancel="grid-drag-cancel"
          padding={padding}
          hoverHeaderOffset={hoverHeaderOffset}
          hoverHeader={this.hasOverlayHeader()}
          displayMode={transparent ? 'transparent' : 'default'}
          onCancelQuery={this.onCancelQuery}
        >
          {(innerWidth, innerHeight) => (
            <>
              <ErrorBoundary
                dependencies={[data, plugin, panel.getOptions()]}
                onError={this.onPanelError}
                onRecover={this.onPanelErrorRecover}
              >
                {({ error }) => {
                  if (error) {
                    return null;
                  }
                  return this.renderPanelContent(innerWidth, innerHeight);
                }}
              </ErrorBoundary>
            </>
          )}
        </PanelChrome>
      );
    } else {
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
          <ErrorBoundary
            dependencies={[data, plugin, panel.getOptions()]}
            onError={this.onPanelError}
            onRecover={this.onPanelErrorRecover}
          >
            {({ error }) => {
              if (error) {
                return null;
              }
              return this.renderPanel(width, height);
            }}
          </ErrorBoundary>
        </section>
      );
    }
  }
}
