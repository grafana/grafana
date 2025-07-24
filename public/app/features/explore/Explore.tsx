import { css, cx } from '@emotion/css';
import { get, groupBy } from 'lodash';
import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import AutoSizer, { HorizontalSize } from 'react-virtualized-auto-sizer';

import {
  AbsoluteTimeRange,
  DataFrame,
  EventBus,
  getNextRefId,
  GrafanaTheme2,
  hasToggleableQueryFiltersSupport,
  LoadingState,
  QueryFixAction,
  RawTimeRange,
  SplitOpenOptions,
  store,
  SupplementaryQueryType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import {
  AdHocFilterItem,
  ErrorBoundaryAlert,
  PanelContainer,
  ScrollContainer,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { supportedFeatures } from 'app/core/history/richHistoryStorageProvider';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { StoreState } from 'app/types/store';

import { getTimeZone } from '../profile/state/selectors';

import { CONTENT_OUTLINE_LOCAL_STORAGE_KEYS, ContentOutline } from './ContentOutline/ContentOutline';
import { ContentOutlineContextProvider } from './ContentOutline/ContentOutlineContext';
import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
import { CorrelationHelper } from './CorrelationHelper';
import { CustomContainer } from './CustomContainer';
import { DrilldownAlertBox } from './DrilldownAlertBox';
import { ExploreToolbar } from './ExploreToolbar';
import { FlameGraphExploreContainer } from './FlameGraph/FlameGraphExploreContainer';
import { GraphContainer } from './Graph/GraphContainer';
import LogsContainer from './Logs/LogsContainer';
import { LogsSamplePanel } from './Logs/LogsSamplePanel';
import { NoData } from './NoData';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { NodeGraphContainer } from './NodeGraph/NodeGraphContainer';
import { QueryRows } from './QueryRows';
import RawPrometheusContainer from './RawPrometheus/RawPrometheusContainer';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import { SecondaryActions } from './SecondaryActions';
import TableContainer from './Table/TableContainer';
import { TraceViewContainer } from './TraceView/TraceViewContainer';
import { changeDatasource } from './state/datasource';
import { changeSize } from './state/explorePane';
import { splitOpen } from './state/main';
import {
  addQueryRow,
  modifyQueries,
  scanStart,
  scanStopAction,
  selectIsWaitingForData,
  setQueries,
  setSupplementaryQueryEnabled,
} from './state/query';
import { isSplit, selectExploreDSMaps } from './state/selectors';
import { updateTimeRange } from './state/time';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    exploreMain: css({
      label: 'exploreMain',
      // Is needed for some transition animations to work.
      position: 'relative',
      marginTop: '21px',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    queryContainer: css({
      label: 'queryContainer',
      padding: theme.spacing(1),
    }),
    exploreContainer: css({
      label: 'exploreContainer',
      display: 'flex',
      flexDirection: 'column',
      paddingRight: theme.spacing(2),
      marginBottom: theme.spacing(2),
    }),
    wrapper: css({
      position: 'absolute',
      top: 0,
      left: theme.spacing(2),
      right: 0,
      bottom: 0,
      display: 'flex',
    }),
  };
};

export interface ExploreProps extends Themeable2 {
  exploreId: string;
  theme: GrafanaTheme2;
  eventBus: EventBus;
  setShowQueryInspector: (value: boolean) => void;
  showQueryInspector: boolean;
}

interface ExploreState {
  contentOutlineVisible: boolean;
}

export type Props = ExploreProps & ConnectedProps<typeof connector>;

/**
 * Explore provides an area for quick query iteration for a given datasource.
 * Once a datasource is selected it populates the query section at the top.
 * When queries are run, their results are being displayed in the main section.
 * The datasource determines what kind of query editor it brings, and what kind
 * of results viewers it supports. The state is managed entirely in Redux.
 *
 * SPLIT VIEW
 *
 * Explore can have two Explore areas side-by-side. This is handled in `Wrapper.tsx`.
 * Since there can be multiple Explores (e.g., left and right) each action needs
 * the `exploreId` as first parameter so that the reducer knows which Explore state
 * is affected.
 *
 * DATASOURCE REQUESTS
 *
 * A click on Run Query creates transactions for all DataQueries for all expanded
 * result viewers. New runs are discarding previous runs. Upon completion a transaction
 * saves the result. The result viewers construct their data from the currently existing
 * transactions.
 *
 * The result viewers determine some of the query options sent to the datasource, e.g.,
 * `format`, to indicate eventual transformations by the datasources' result transformers.
 */

export class Explore extends PureComponent<Props, ExploreState> {
  scrollElement: HTMLDivElement | undefined;
  graphEventBus: EventBus;
  logsEventBus: EventBus;

  constructor(props: Props) {
    super(props);
    this.state = {
      contentOutlineVisible: store.getBool(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.visible, true),
    };
    this.graphEventBus = props.eventBus.newScopedBus('graph', { onlyLocal: false });
    this.logsEventBus = props.eventBus.newScopedBus('logs', { onlyLocal: false });
  }

  onChangeTime = (rawRange: RawTimeRange) => {
    const { updateTimeRange, exploreId } = this.props;
    updateTimeRange({ exploreId, rawRange });
  };

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    this.props.setQueries(this.props.exploreId, [query]);
  };

  onCellFilterAdded = (filter: AdHocFilterItem) => {
    const { value, key, operator } = filter;
    if (operator === FILTER_FOR_OPERATOR) {
      this.onClickFilterLabel(key, value);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      this.onClickFilterOutLabel(key, value);
    }
  };

  onContentOutlineToogle = () => {
    store.set(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.visible, !this.state.contentOutlineVisible);
    this.setState((state) => {
      reportInteraction('explore_toolbar_contentoutline_clicked', {
        item: 'outline',
        type: state.contentOutlineVisible ? 'close' : 'open',
      });
      return {
        contentOutlineVisible: !state.contentOutlineVisible,
      };
    });
  };

  /**
   * Used by Logs details.
   * Returns true if the query identified by `refId` has a filter with the provided key and value.
   * @alpha
   */
  isFilterLabelActive = async (key: string, value: string | number, refId?: string) => {
    const query = this.props.queries.find((q) => q.refId === refId);
    if (!query) {
      return false;
    }
    const ds = await getDataSourceSrv().get(query.datasource);
    if (hasToggleableQueryFiltersSupport(ds) && ds.queryHasFilter(query, { key, value: value.toString() })) {
      return true;
    }
    return false;
  };

  /**
   * Used by Logs details.
   */
  onClickFilterLabel = (key: string, value: string | number, frame?: DataFrame) => {
    this.onModifyQueries(
      {
        type: 'ADD_FILTER',
        options: { key, value: value.toString() },
        frame,
      },
      frame?.refId
    );
  };

  /**
   * Used by Logs details.
   */
  onClickFilterOutLabel = (key: string, value: string | number, frame?: DataFrame) => {
    this.onModifyQueries(
      {
        type: 'ADD_FILTER_OUT',
        options: { key, value: value.toString() },
        frame,
      },
      frame?.refId
    );
  };

  /**
   * Used by Logs Popover Menu.
   */
  onClickFilterString = (value: string | number, refId?: string) => {
    this.onModifyQueries({ type: 'ADD_STRING_FILTER', options: { value: value.toString() } }, refId);
  };

  /**
   * Used by Logs Popover Menu.
   */
  onClickFilterOutString = (value: string | number, refId?: string) => {
    this.onModifyQueries({ type: 'ADD_STRING_FILTER_OUT', options: { value: value.toString() } }, refId);
  };

  onClickAddQueryRowButton = () => {
    const { exploreId, queryKeys } = this.props;
    this.props.addQueryRow(exploreId, queryKeys.length);
  };

  /**
   * Used by Logs details.
   */
  onModifyQueries = (action: QueryFixAction, refId?: string) => {
    const modifier = async (query: DataQuery, modification: QueryFixAction) => {
      // This gives Logs Details support to modify the query that produced the log line.
      // If not present, all queries are modified.
      if (refId && refId !== query.refId) {
        return query;
      }
      const { datasource } = query;
      if (datasource == null) {
        return query;
      }
      const ds = await getDataSourceSrv().get(datasource);
      const toggleableFilters = ['ADD_FILTER', 'ADD_FILTER_OUT'];
      if (hasToggleableQueryFiltersSupport(ds) && toggleableFilters.includes(modification.type)) {
        return ds.toggleQueryFilter(query, {
          type: modification.type === 'ADD_FILTER' ? 'FILTER_FOR' : 'FILTER_OUT',
          options: modification.options ?? {},
          frame: modification.frame,
        });
      }
      if (ds.modifyQuery) {
        return ds.modifyQuery(query, modification);
      } else {
        return query;
      }
    };
    this.props.modifyQueries(this.props.exploreId, action, modifier);
  };

  onResize = (size: HorizontalSize) => {
    this.props.changeSize(this.props.exploreId, size);
  };

  onStartScanning = () => {
    // Scanner will trigger a query
    this.props.scanStart(this.props.exploreId);
  };

  onStopScanning = () => {
    this.props.scanStopAction({ exploreId: this.props.exploreId });
  };

  onUpdateTimeRange = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
  };

  onSplitOpen = (panelType: string) => {
    return async (options?: SplitOpenOptions) => {
      this.props.splitOpen(options);
      if (options && this.props.datasourceInstance) {
        const target = (await getDataSourceSrv().get(options.datasourceUid)).type;
        const source =
          this.props.datasourceInstance.uid === MIXED_DATASOURCE_NAME
            ? get(this.props.queries, '0.datasource.type')
            : this.props.datasourceInstance.type;
        const tracking = {
          origin: 'panel',
          panelType,
          source,
          target,
          exploreId: this.props.exploreId,
        };
        reportInteraction('grafana_explore_split_view_opened', tracking);
      }
    };
  };

  onPinLineCallback = () => {
    this.setState({ contentOutlineVisible: true });
  };

  renderEmptyState(exploreContainerStyles: string) {
    return (
      <div className={cx(exploreContainerStyles)}>
        <NoDataSourceCallToAction />
      </div>
    );
  }

  renderNoData() {
    return <NoData />;
  }

  renderCustom(width: number) {
    const { timeZone, queryResponse, eventBus } = this.props;

    const groupedByPlugin = groupBy(queryResponse?.customFrames, 'meta.preferredVisualisationPluginId');

    return Object.entries(groupedByPlugin).map(([pluginId, frames], index) => {
      return (
        <ContentOutlineItem panelId={pluginId} title={pluginId} icon="plug" key={index}>
          <CustomContainer
            key={index}
            timeZone={timeZone}
            pluginId={pluginId}
            frames={frames}
            state={queryResponse.state}
            timeRange={queryResponse.timeRange}
            height={400}
            width={width}
            splitOpenFn={this.onSplitOpen(pluginId)}
            eventBus={eventBus}
          />
        </ContentOutlineItem>
      );
    });
  }

  renderGraphPanel(width: number) {
    const { graphResult, timeZone, queryResponse, showFlameGraph } = this.props;

    return (
      <ContentOutlineItem panelId="Graph" title={t('explore.explore.title-graph', 'Graph')} icon="graph-bar">
        <GraphContainer
          data={graphResult!}
          height={showFlameGraph ? 180 : 400}
          width={width}
          timeRange={queryResponse.timeRange}
          timeZone={timeZone}
          onChangeTime={this.onUpdateTimeRange}
          annotations={queryResponse.annotations}
          splitOpenFn={this.onSplitOpen('graph')}
          loadingState={queryResponse.state}
          eventBus={this.graphEventBus}
        />
      </ContentOutlineItem>
    );
  }

  renderTablePanel(width: number) {
    const { exploreId, timeZone } = this.props;
    return (
      <ContentOutlineItem panelId="Table" title={t('explore.explore.title-table', 'Table')} icon="table">
        <TableContainer
          ariaLabel={selectors.pages.Explore.General.table}
          width={width}
          exploreId={exploreId}
          onCellFilterAdded={this.onCellFilterAdded}
          timeZone={timeZone}
          splitOpenFn={this.onSplitOpen('table')}
        />
      </ContentOutlineItem>
    );
  }

  renderRawPrometheus(width: number) {
    const { exploreId, datasourceInstance, timeZone } = this.props;
    return (
      <ContentOutlineItem
        panelId="Raw Prometheus"
        title={t('explore.explore.title-raw-prometheus', 'Raw Prometheus')}
        icon="gf-prometheus"
      >
        <RawPrometheusContainer
          showRawPrometheus={true}
          ariaLabel={selectors.pages.Explore.General.table}
          width={width}
          exploreId={exploreId}
          onCellFilterAdded={datasourceInstance?.modifyQuery ? this.onCellFilterAdded : undefined}
          timeZone={timeZone}
          splitOpenFn={this.onSplitOpen('table')}
        />
      </ContentOutlineItem>
    );
  }

  splitOpenFnLogs = this.onSplitOpen('logs');

  renderLogsPanel(width: number) {
    const { exploreId, syncedTimes, theme, queryResponse } = this.props;
    const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
    // Need to make ContentOutlineItem a flex container so the gap works
    const logsContentOutlineWrapper = css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    });
    return (
      <ContentOutlineItem
        panelId="Logs"
        title={t('explore.explore.title-logs', 'Logs')}
        icon="gf-logs"
        className={logsContentOutlineWrapper}
      >
        <LogsContainer
          exploreId={exploreId}
          loadingState={queryResponse.state}
          syncedTimes={syncedTimes}
          width={width - spacing}
          onClickFilterLabel={this.onClickFilterLabel}
          onClickFilterOutLabel={this.onClickFilterOutLabel}
          onStartScanning={this.onStartScanning}
          onStopScanning={this.onStopScanning}
          eventBus={this.logsEventBus}
          splitOpenFn={this.splitOpenFnLogs}
          scrollElement={this.scrollElement}
          isFilterLabelActive={this.isFilterLabelActive}
          onClickFilterString={this.onClickFilterString}
          onClickFilterOutString={this.onClickFilterOutString}
          onPinLineCallback={this.onPinLineCallback}
        />
      </ContentOutlineItem>
    );
  }

  renderLogsSamplePanel() {
    const {
      logsSample,
      timeZone,
      setSupplementaryQueryEnabled,
      exploreId,
      datasourceInstance,
      queries,
      queryResponse,
    } = this.props;

    return (
      <ContentOutlineItem
        panelId="Logs Sample"
        title={t('explore.explore.title-logs-sample', 'Logs sample')}
        icon="gf-logs"
      >
        <LogsSamplePanel
          queryResponse={logsSample.data}
          timeZone={timeZone}
          enabled={logsSample.enabled}
          queries={queries}
          datasourceInstance={datasourceInstance}
          splitOpen={this.onSplitOpen('logsSample')}
          setLogsSampleEnabled={(enabled: boolean) =>
            setSupplementaryQueryEnabled(exploreId, enabled, SupplementaryQueryType.LogsSample)
          }
          timeRange={queryResponse.timeRange}
        />
      </ContentOutlineItem>
    );
  }

  renderNodeGraphPanel() {
    const { exploreId, showTrace, queryResponse, datasourceInstance } = this.props;
    const datasourceType = datasourceInstance ? datasourceInstance?.type : 'unknown';

    return (
      <ContentOutlineItem
        panelId="Node Graph"
        title={t('explore.explore.title-node-graph', 'Node graph')}
        icon="code-branch"
      >
        <NodeGraphContainer
          dataFrames={queryResponse.nodeGraphFrames}
          exploreId={exploreId}
          withTraceView={showTrace}
          datasourceType={datasourceType}
          splitOpenFn={this.onSplitOpen('nodeGraph')}
        />
      </ContentOutlineItem>
    );
  }

  renderFlameGraphPanel() {
    const { queryResponse } = this.props;
    return (
      <ContentOutlineItem
        panelId="Flame Graph"
        title={t('explore.explore.title-flame-graph', 'Flame graph')}
        icon="fire"
      >
        <FlameGraphExploreContainer dataFrames={queryResponse.flameGraphFrames} />
      </ContentOutlineItem>
    );
  }

  renderTraceViewPanel() {
    const { queryResponse, exploreId } = this.props;
    const dataFrames = queryResponse.series.filter((series) => series.meta?.preferredVisualisationType === 'trace');

    return (
      // If there is no data (like 404) we show a separate error so no need to show anything here
      dataFrames.length && (
        <ContentOutlineItem panelId="Traces" title={t('explore.explore.title-traces', 'Traces')} icon="file-alt">
          <TraceViewContainer
            exploreId={exploreId}
            dataFrames={dataFrames}
            splitOpenFn={this.onSplitOpen('traceView')}
            scrollElement={this.scrollElement}
            timeRange={queryResponse.timeRange}
          />
        </ContentOutlineItem>
      )
    );
  }

  render() {
    const {
      datasourceInstance,
      exploreId,
      graphResult,
      queryResponse,
      isLive,
      theme,
      showMetrics,
      showTable,
      showRawPrometheus,
      showLogs,
      showTrace,
      showCustom,
      showNodeGraph,
      showFlameGraph,
      showLogsSample,
      correlationEditorDetails,
      correlationEditorHelperData,
      showQueryInspector,
      setShowQueryInspector,
    } = this.props;
    const { contentOutlineVisible } = this.state;
    const styles = getStyles(theme);
    const showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;
    const richHistoryRowButtonHidden = !supportedFeatures().queryHistoryAvailable;
    const showNoData =
      queryResponse.state === LoadingState.Done &&
      [
        queryResponse.logsFrames,
        queryResponse.graphFrames,
        queryResponse.nodeGraphFrames,
        queryResponse.flameGraphFrames,
        queryResponse.tableFrames,
        queryResponse.rawPrometheusFrames,
        queryResponse.traceFrames,
        queryResponse.customFrames,
      ].every((e) => e.length === 0);

    let correlationsBox = undefined;
    const isCorrelationsEditorMode = correlationEditorDetails?.editorMode;
    const showCorrelationHelper = Boolean(isCorrelationsEditorMode || correlationEditorDetails?.correlationDirty);
    if (showCorrelationHelper && correlationEditorHelperData !== undefined) {
      correlationsBox = <CorrelationHelper exploreId={exploreId} correlations={correlationEditorHelperData} />;
    }

    return (
      <ContentOutlineContextProvider refreshDependencies={this.props.queries}>
        <ExploreToolbar
          exploreId={exploreId}
          onChangeTime={this.onChangeTime}
          onContentOutlineToogle={this.onContentOutlineToogle}
          isContentOutlineOpen={contentOutlineVisible}
        />
        <div
          style={{
            position: 'relative',
            height: '100%',
            paddingLeft: theme.spacing(2),
          }}
        >
          <div className={styles.wrapper}>
            {contentOutlineVisible && (
              <ContentOutline scroller={this.scrollElement} panelId={`content-outline-container-${exploreId}`} />
            )}
            <ScrollContainer
              data-testid={selectors.pages.Explore.General.scrollView}
              ref={(scrollElement) => (this.scrollElement = scrollElement || undefined)}
            >
              <div className={styles.exploreContainer}>
                {datasourceInstance ? (
                  <>
                    <ContentOutlineItem
                      panelId="Queries"
                      title={t('explore.explore.title-queries', 'Queries')}
                      icon="arrow"
                      mergeSingleChild={true}
                    >
                      <PanelContainer className={styles.queryContainer}>
                        <DrilldownAlertBox datasourceType={datasourceInstance?.type || ''} />
                        {correlationsBox}
                        <QueryRows exploreId={exploreId} />
                        <SecondaryActions
                          // do not allow people to add queries with potentially different datasources in correlations editor mode
                          addQueryRowButtonDisabled={
                            isLive || (isCorrelationsEditorMode && datasourceInstance.meta.mixed)
                          }
                          // We cannot show multiple traces at the same time right now so we do not show add query button.
                          //TODO:unification
                          addQueryRowButtonHidden={false}
                          richHistoryRowButtonHidden={richHistoryRowButtonHidden}
                          queryInspectorButtonActive={showQueryInspector}
                          onClickAddQueryRowButton={this.onClickAddQueryRowButton}
                          onClickQueryInspectorButton={() => setShowQueryInspector(!showQueryInspector)}
                          onSelectQueryFromLibrary={async (query) => {
                            const { changeDatasource, queries, setQueries } = this.props;
                            const newQueries = [
                              ...queries,
                              {
                                ...query,
                                refId: getNextRefId(queries),
                              },
                            ];
                            setQueries(exploreId, newQueries);
                            if (query.datasource?.uid) {
                              const uniqueDatasources = new Set(newQueries.map((q) => q.datasource?.uid));
                              const isMixed = uniqueDatasources.size > 1;
                              const newDatasourceRef = {
                                uid: isMixed ? MIXED_DATASOURCE_NAME : query.datasource.uid,
                              };
                              const shouldChangeDatasource = datasourceInstance.uid !== newDatasourceRef.uid;
                              if (shouldChangeDatasource) {
                                await changeDatasource({ exploreId, datasource: newDatasourceRef });
                              }
                            }
                          }}
                        />
                        <ResponseErrorContainer exploreId={exploreId} />
                      </PanelContainer>
                    </ContentOutlineItem>
                    <AutoSizer onResize={this.onResize} disableHeight>
                      {({ width }) => {
                        if (width === 0) {
                          return null;
                        }

                        return (
                          <main className={cx(styles.exploreMain)} style={{ width }}>
                            <ErrorBoundaryAlert>
                              {showPanels && (
                                <>
                                  {showMetrics && graphResult && (
                                    <ErrorBoundaryAlert>{this.renderGraphPanel(width)}</ErrorBoundaryAlert>
                                  )}
                                  {showRawPrometheus && (
                                    <ErrorBoundaryAlert>{this.renderRawPrometheus(width)}</ErrorBoundaryAlert>
                                  )}
                                  {showTable && <ErrorBoundaryAlert>{this.renderTablePanel(width)}</ErrorBoundaryAlert>}
                                  {showLogs && <ErrorBoundaryAlert>{this.renderLogsPanel(width)}</ErrorBoundaryAlert>}
                                  {showNodeGraph && (
                                    <ErrorBoundaryAlert>{this.renderNodeGraphPanel()}</ErrorBoundaryAlert>
                                  )}
                                  {showFlameGraph && (
                                    <ErrorBoundaryAlert>{this.renderFlameGraphPanel()}</ErrorBoundaryAlert>
                                  )}
                                  {showTrace && <ErrorBoundaryAlert>{this.renderTraceViewPanel()}</ErrorBoundaryAlert>}
                                  {showLogsSample && (
                                    <ErrorBoundaryAlert>{this.renderLogsSamplePanel()}</ErrorBoundaryAlert>
                                  )}
                                  {showCustom && <ErrorBoundaryAlert>{this.renderCustom(width)}</ErrorBoundaryAlert>}
                                  {showNoData && <ErrorBoundaryAlert>{this.renderNoData()}</ErrorBoundaryAlert>}
                                </>
                              )}
                            </ErrorBoundaryAlert>
                          </main>
                        );
                      }}
                    </AutoSizer>
                  </>
                ) : (
                  this.renderEmptyState(styles.exploreContainer)
                )}
              </div>
            </ScrollContainer>
          </div>
        </div>
      </ContentOutlineContextProvider>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: ExploreProps) {
  const explore = state.explore;
  const { syncedTimes } = explore;
  const item = explore.panes[exploreId]!;

  const timeZone = getTimeZone(state.user);
  const {
    datasourceInstance,
    queryKeys,
    queries,
    isLive,
    graphResult,
    tableResult,
    logsResult,
    showLogs,
    showMetrics,
    showTable,
    showTrace,
    showCustom,
    queryResponse,
    showNodeGraph,
    showFlameGraph,
    showRawPrometheus,
    supplementaryQueries,
    correlationEditorHelperData,
  } = item;

  const loading = selectIsWaitingForData(exploreId)(state);
  const logsSample = supplementaryQueries[SupplementaryQueryType.LogsSample];
  // We want to show logs sample only if there are no log results and if there is already graph or table result
  const showLogsSample = !!(logsSample.dataProvider !== undefined && !logsResult && (graphResult || tableResult));

  return {
    datasourceInstance,
    queryKeys,
    queries,
    isLive,
    graphResult,
    logsResult: logsResult ?? undefined,
    queryResponse,
    syncedTimes,
    timeZone,
    showLogs,
    showMetrics,
    showTable,
    showTrace,
    showCustom,
    showNodeGraph,
    showRawPrometheus,
    showFlameGraph,
    splitted: isSplit(state),
    loading,
    logsSample,
    showLogsSample,
    correlationEditorHelperData,
    correlationEditorDetails: explore.correlationEditorDetails,
    exploreActiveDS: selectExploreDSMaps(state),
  };
}

const mapDispatchToProps = {
  changeDatasource,
  changeSize,
  modifyQueries,
  scanStart,
  scanStopAction,
  setQueries,
  updateTimeRange,
  addQueryRow,
  splitOpen,
  setSupplementaryQueryEnabled,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default withTheme2(connector(Explore));
