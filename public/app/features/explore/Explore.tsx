import { css, cx } from '@emotion/css';
import { get } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { createRef } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Unsubscribable } from 'rxjs';

import {
  AbsoluteTimeRange,
  GrafanaTheme2,
  LoadingState,
  QueryFixAction,
  RawTimeRange,
  EventBus,
  SplitOpenOptions,
  SupplementaryQueryType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import {
  CustomScrollbar,
  ErrorBoundaryAlert,
  Themeable2,
  withTheme2,
  PanelContainer,
  Alert,
  AdHocFilterItem,
} from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';
import appEvents from 'app/core/app_events';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
import { supportedFeatures } from 'app/core/history/richHistoryStorageProvider';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { getNodeGraphDataFrames } from 'app/plugins/panel/nodeGraph/utils';
import { StoreState } from 'app/types';
import { AbsoluteTimeEvent } from 'app/types/events';
import { ExploreId, ExploreItemState } from 'app/types/explore';

import { getTimeZone } from '../profile/state/selectors';

import ExploreQueryInspector from './ExploreQueryInspector';
import { ExploreToolbar } from './ExploreToolbar';
import { FlameGraphExploreContainer } from './FlameGraphExploreContainer';
import { GraphContainer } from './Graph/GraphContainer';
import LogsContainer from './LogsContainer';
import { LogsSamplePanel } from './LogsSamplePanel';
import { NoData } from './NoData';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { NodeGraphContainer } from './NodeGraphContainer';
import { QueryRows } from './QueryRows';
import RawPrometheusContainer from './RawPrometheusContainer';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import RichHistoryContainer from './RichHistory/RichHistoryContainer';
import { SecondaryActions } from './SecondaryActions';
import TableContainer from './TableContainer';
import { TraceViewContainer } from './TraceView/TraceViewContainer';
import { changeSize } from './state/explorePane';
import { splitOpen } from './state/main';
import {
  addQueryRow,
  modifyQueries,
  scanStart,
  scanStopAction,
  setQueries,
  setSupplementaryQueryEnabled,
} from './state/query';
import { isSplit } from './state/selectors';
import { makeAbsoluteTime, updateTimeRange } from './state/time';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    exploreMain: css`
      label: exploreMain;
      // Is needed for some transition animations to work.
      position: relative;
      margin-top: 21px;
    `,
    button: css`
      label: button;
      margin: 1em 4px 0 0;
    `,
    queryContainer: css`
      label: queryContainer;
      // Need to override normal css class and don't want to count on ordering of the classes in html.
      height: auto !important;
      flex: unset !important;
      display: unset !important;
      padding: ${theme.spacing(1)};
    `,
    exploreContainer: css`
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      padding: ${theme.spacing(2)};
      padding-top: 0;
    `,
  };
};

export interface ExploreProps extends Themeable2 {
  exploreId: ExploreId;
  theme: GrafanaTheme2;
  eventBus: EventBus;
}

enum ExploreDrawer {
  RichHistory,
  QueryInspector,
}

interface ExploreState {
  openDrawer?: ExploreDrawer;
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
export class Explore extends React.PureComponent<Props, ExploreState> {
  scrollElement: HTMLDivElement | undefined;
  absoluteTimeUnsubsciber: Unsubscribable | undefined;
  topOfViewRef = createRef<HTMLDivElement>();
  graphEventBus: EventBus;
  logsEventBus: EventBus;

  constructor(props: Props) {
    super(props);
    this.state = {
      openDrawer: undefined,
    };
    this.graphEventBus = props.eventBus.newScopedBus('graph', { onlyLocal: false });
    this.logsEventBus = props.eventBus.newScopedBus('logs', { onlyLocal: false });
  }

  componentDidMount() {
    this.absoluteTimeUnsubsciber = appEvents.subscribe(AbsoluteTimeEvent, this.onMakeAbsoluteTime);
  }

  componentWillUnmount() {
    this.absoluteTimeUnsubsciber?.unsubscribe();
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

  onClickFilterLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', options: { key, value } });
  };

  onClickFilterOutLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER_OUT', options: { key, value } });
  };

  onClickAddQueryRowButton = () => {
    const { exploreId, queryKeys } = this.props;
    this.props.addQueryRow(exploreId, queryKeys.length);
  };

  onMakeAbsoluteTime = () => {
    const { makeAbsoluteTime } = this.props;
    makeAbsoluteTime();
  };

  onModifyQueries = (action: QueryFixAction) => {
    const modifier = async (query: DataQuery, modification: QueryFixAction) => {
      const { datasource } = query;
      if (datasource == null) {
        return query;
      }
      const ds = await getDataSourceSrv().get(datasource);
      if (ds.modifyQuery) {
        return ds.modifyQuery(query, modification);
      } else {
        return query;
      }
    };
    this.props.modifyQueries(this.props.exploreId, action, modifier);
  };

  onResize = (size: { height: number; width: number }) => {
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

  toggleShowRichHistory = () => {
    this.setState((state) => {
      return {
        openDrawer: state.openDrawer === ExploreDrawer.RichHistory ? undefined : ExploreDrawer.RichHistory,
      };
    });
  };

  toggleShowQueryInspector = () => {
    this.setState((state) => {
      return {
        openDrawer: state.openDrawer === ExploreDrawer.QueryInspector ? undefined : ExploreDrawer.QueryInspector,
      };
    });
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

  renderCompactUrlWarning() {
    return (
      <FadeIn in={true} duration={100}>
        <Alert severity="warning" title="Compact URL Deprecation Notice" topSpacing={2}>
          The URL that brought you here was a compact URL - this format will soon be deprecated. Please replace the URL
          previously saved with the URL available now.
        </Alert>
      </FadeIn>
    );
  }

  renderGraphPanel(width: number) {
    const { graphResult, absoluteRange, timeZone, queryResponse, loading, showFlameGraph } = this.props;

    return (
      <GraphContainer
        loading={loading}
        data={graphResult!}
        height={showFlameGraph ? 180 : 400}
        width={width}
        absoluteRange={absoluteRange}
        timeZone={timeZone}
        onChangeTime={this.onUpdateTimeRange}
        annotations={queryResponse.annotations}
        splitOpenFn={this.onSplitOpen('graph')}
        loadingState={queryResponse.state}
        eventBus={this.graphEventBus}
      />
    );
  }

  renderTablePanel(width: number) {
    const { exploreId, timeZone } = this.props;
    return (
      <TableContainer
        ariaLabel={selectors.pages.Explore.General.table}
        width={width}
        exploreId={exploreId}
        onCellFilterAdded={this.onCellFilterAdded}
        timeZone={timeZone}
        splitOpenFn={this.onSplitOpen('table')}
      />
    );
  }

  renderRawPrometheus(width: number) {
    const { exploreId, datasourceInstance, timeZone } = this.props;
    return (
      <RawPrometheusContainer
        showRawPrometheus={true}
        ariaLabel={selectors.pages.Explore.General.table}
        width={width}
        exploreId={exploreId}
        onCellFilterAdded={datasourceInstance?.modifyQuery ? this.onCellFilterAdded : undefined}
        timeZone={timeZone}
        splitOpenFn={this.onSplitOpen('table')}
      />
    );
  }

  renderLogsPanel(width: number) {
    const { exploreId, syncedTimes, theme, queryResponse } = this.props;
    const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
    return (
      <LogsContainer
        exploreId={exploreId}
        loadingState={queryResponse.state}
        syncedTimes={syncedTimes}
        width={width - spacing}
        onClickFilterLabel={this.onClickFilterLabel}
        onClickFilterOutLabel={this.onClickFilterOutLabel}
        onStartScanning={this.onStartScanning}
        onStopScanning={this.onStopScanning}
        scrollElement={this.scrollElement}
        eventBus={this.logsEventBus}
        splitOpenFn={this.onSplitOpen('logs')}
      />
    );
  }

  renderLogsSamplePanel() {
    const { logsSample, timeZone, setSupplementaryQueryEnabled, exploreId, datasourceInstance, queries } = this.props;

    return (
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
      />
    );
  }

  renderNodeGraphPanel() {
    const { exploreId, showTrace, queryResponse, datasourceInstance } = this.props;
    const datasourceType = datasourceInstance ? datasourceInstance?.type : 'unknown';

    return (
      <NodeGraphContainer
        dataFrames={this.memoizedGetNodeGraphDataFrames(queryResponse.series)}
        exploreId={exploreId}
        withTraceView={showTrace}
        datasourceType={datasourceType}
        splitOpenFn={this.onSplitOpen('nodeGraph')}
      />
    );
  }

  memoizedGetNodeGraphDataFrames = memoizeOne(getNodeGraphDataFrames);

  renderFlameGraphPanel() {
    const { queryResponse } = this.props;
    return <FlameGraphExploreContainer dataFrames={queryResponse.flameGraphFrames} />;
  }

  renderTraceViewPanel() {
    const { queryResponse, exploreId } = this.props;
    const dataFrames = queryResponse.series.filter((series) => series.meta?.preferredVisualisationType === 'trace');

    return (
      // If there is no data (like 404) we show a separate error so no need to show anything here
      dataFrames.length && (
        <TraceViewContainer
          exploreId={exploreId}
          dataFrames={dataFrames}
          splitOpenFn={this.onSplitOpen('traceView')}
          scrollElement={this.scrollElement}
          queryResponse={queryResponse}
          topOfViewRef={this.topOfViewRef}
        />
      )
    );
  }

  render() {
    const {
      datasourceInstance,
      datasourceMissing,
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
      showNodeGraph,
      showFlameGraph,
      timeZone,
      isFromCompactUrl,
      showLogsSample,
    } = this.props;
    const { openDrawer } = this.state;
    const styles = getStyles(theme);
    const showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;
    const showRichHistory = openDrawer === ExploreDrawer.RichHistory;
    const richHistoryRowButtonHidden = !supportedFeatures().queryHistoryAvailable;
    const showQueryInspector = openDrawer === ExploreDrawer.QueryInspector;
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
      ].every((e) => e.length === 0);

    return (
      <CustomScrollbar
        testId={selectors.pages.Explore.General.scrollView}
        autoHeightMin={'100%'}
        scrollRefCallback={(scrollElement) => (this.scrollElement = scrollElement || undefined)}
      >
        <ExploreToolbar exploreId={exploreId} onChangeTime={this.onChangeTime} topOfViewRef={this.topOfViewRef} />
        {isFromCompactUrl ? this.renderCompactUrlWarning() : null}
        {datasourceMissing ? this.renderEmptyState(styles.exploreContainer) : null}
        {datasourceInstance && (
          <div className={styles.exploreContainer}>
            <PanelContainer className={styles.queryContainer}>
              <QueryRows exploreId={exploreId} />
              <SecondaryActions
                addQueryRowButtonDisabled={isLive}
                // We cannot show multiple traces at the same time right now so we do not show add query button.
                //TODO:unification
                addQueryRowButtonHidden={false}
                richHistoryRowButtonHidden={richHistoryRowButtonHidden}
                richHistoryButtonActive={showRichHistory}
                queryInspectorButtonActive={showQueryInspector}
                onClickAddQueryRowButton={this.onClickAddQueryRowButton}
                onClickRichHistoryButton={this.toggleShowRichHistory}
                onClickQueryInspectorButton={this.toggleShowQueryInspector}
              />
              <ResponseErrorContainer exploreId={exploreId} />
            </PanelContainer>
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
                          {showNodeGraph && <ErrorBoundaryAlert>{this.renderNodeGraphPanel()}</ErrorBoundaryAlert>}
                          {showFlameGraph && <ErrorBoundaryAlert>{this.renderFlameGraphPanel()}</ErrorBoundaryAlert>}
                          {showTrace && <ErrorBoundaryAlert>{this.renderTraceViewPanel()}</ErrorBoundaryAlert>}
                          {config.featureToggles.logsSampleInExplore && showLogsSample && (
                            <ErrorBoundaryAlert>{this.renderLogsSamplePanel()}</ErrorBoundaryAlert>
                          )}
                          {showNoData && <ErrorBoundaryAlert>{this.renderNoData()}</ErrorBoundaryAlert>}
                        </>
                      )}
                      {showRichHistory && (
                        <RichHistoryContainer
                          width={width}
                          exploreId={exploreId}
                          onClose={this.toggleShowRichHistory}
                        />
                      )}
                      {showQueryInspector && (
                        <ExploreQueryInspector
                          exploreId={exploreId}
                          width={width}
                          onClose={this.toggleShowQueryInspector}
                          timeZone={timeZone}
                        />
                      )}
                    </ErrorBoundaryAlert>
                  </main>
                );
              }}
            </AutoSizer>
          </div>
        )}
      </CustomScrollbar>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: ExploreProps) {
  const explore = state.explore;
  const { syncedTimes } = explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const timeZone = getTimeZone(state.user);
  const {
    datasourceInstance,
    datasourceMissing,
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
    absoluteRange,
    queryResponse,
    showNodeGraph,
    showFlameGraph,
    loading,
    isFromCompactUrl,
    showRawPrometheus,
    supplementaryQueries,
  } = item;

  const logsSample = supplementaryQueries[SupplementaryQueryType.LogsSample];
  // We want to show logs sample only if there are no log results and if there is already graph or table result
  const showLogsSample = !!(logsSample.dataProvider !== undefined && !logsResult && (graphResult || tableResult));

  return {
    datasourceInstance,
    datasourceMissing,
    queryKeys,
    queries,
    isLive,
    graphResult,
    logsResult: logsResult ?? undefined,
    absoluteRange,
    queryResponse,
    syncedTimes,
    timeZone,
    showLogs,
    showMetrics,
    showTable,
    showTrace,
    showNodeGraph,
    showRawPrometheus,
    showFlameGraph,
    splitted: isSplit(state),
    loading,
    isFromCompactUrl: isFromCompactUrl || false,
    logsSample,
    showLogsSample,
  };
}

const mapDispatchToProps = {
  changeSize,
  modifyQueries,
  scanStart,
  scanStopAction,
  setQueries,
  updateTimeRange,
  makeAbsoluteTime,
  addQueryRow,
  splitOpen,
  setSupplementaryQueryEnabled,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default withTheme2(connector(Explore));
