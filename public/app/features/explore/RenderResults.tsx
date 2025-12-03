import { css, cx } from '@emotion/css';
import { createSelector } from '@reduxjs/toolkit';
import { groupBy } from 'lodash';
import { useCallback, useMemo } from 'react';
import AutoSizer, { HorizontalSize } from 'react-virtualized-auto-sizer';

import {
  AbsoluteTimeRange,
  DataFrame,
  EventBus,
  GrafanaTheme2,
  LoadingState,
  SplitOpen,
  SupplementaryQueryType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { AdHocFilterItem, ErrorBoundaryAlert, useTheme2 } from '@grafana/ui';

import { ExplorePanelData } from '../../types/explore';
import { StoreState, useDispatch, useSelector } from '../../types/store';
import { getTimeZone } from '../profile/state/selectors';

import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
import { CustomContainer } from './CustomContainer';
import { FlameGraphExploreContainer } from './FlameGraph/FlameGraphExploreContainer';
import { GraphContainer } from './Graph/GraphContainer';
import LogsContainer from './Logs/LogsContainer';
import { LogsSamplePanel } from './Logs/LogsSamplePanel';
import { NoData } from './NoData';
import { NodeGraphContainer } from './NodeGraph/NodeGraphContainer';
import RawPrometheusContainer from './RawPrometheus/RawPrometheusContainer';
import TableContainer from './Table/TableContainer';
import { TraceViewContainer } from './TraceView/TraceViewContainer';
import { changeSize } from './state/explorePane';
import { scanStart, scanStopAction, setSupplementaryQueryEnabled } from './state/query';
import { updateTimeRange } from './state/time';
import { filterByQueryRef, hasItemsForQuery, matchesQueryRef } from './utils/queryRef';

type Props = {
  onSplitOpen: (panelType: string) => SplitOpen;
  graphResult: DataFrame[] | null;
  exploreId: string;
  queryRef: string;

  graphEventBus: EventBus;
  logsEventBus: EventBus;
  eventBus: EventBus;

  onCellFilterAdded: (filter: AdHocFilterItem) => void;

  onClickFilterLabel: (key: string, value: string | number, frame?: DataFrame) => void;
  onClickFilterOutLabel: (key: string, value: string | number, frame?: DataFrame) => void;
  onClickFilterString: (value: string | number, refId?: string) => void;
  onClickFilterOutString: (value: string | number, refId?: string) => void;

  isFilterLabelActive: (key: string, value: string | number, refId?: string) => Promise<boolean>;

  onPinLineCallback: () => void;

  scrollElement: HTMLDivElement | undefined;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    exploreMain: css({
      label: 'exploreMain',
      // Is needed for some transition animations to work.
      position: 'relative',
      marginTop: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      maxHeight: '400px',
      overflow: 'auto',
    }),
  };
};

export function RenderResults(props: Props) {
  const {
    onSplitOpen,
    graphResult,
    exploreId,
    queryRef,
    graphEventBus,
    logsEventBus,
    eventBus,
    onCellFilterAdded,
    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickFilterString,
    onClickFilterOutString,
    isFilterLabelActive,
    onPinLineCallback,
    scrollElement,
  } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const { showLogs, showCustom, showMetrics, showTable, showNodeGraph, showRawPrometheus, showFlameGraph, showTrace } =
    useShowDatatype(exploreId);
  const { showLogsSample } = useLogsSample(exploreId);

  const queryResponse = useQueryResponse(exploreId);
  const queries = useQueries(exploreId);
  const allowUntypedFrames = queries.length <= 1;
  const showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;

  const hasLogsData = hasItemsForQuery(queryResponse.logsFrames, queryRef, allowUntypedFrames);
  const hasGraphData = hasItemsForQuery(queryResponse.graphFrames, queryRef, allowUntypedFrames);
  const hasNodeGraphData = hasItemsForQuery(queryResponse.nodeGraphFrames, queryRef, allowUntypedFrames);
  const hasFlameGraphData = hasItemsForQuery(queryResponse.flameGraphFrames, queryRef, allowUntypedFrames);
  const hasTableData = hasItemsForQuery(queryResponse.tableFrames, queryRef, allowUntypedFrames);
  const hasRawPrometheusData = hasItemsForQuery(queryResponse.rawPrometheusFrames, queryRef, allowUntypedFrames);
  const hasTraceData = hasItemsForQuery(queryResponse.traceFrames, queryRef, allowUntypedFrames);
  const hasCustomData = hasItemsForQuery(queryResponse.customFrames, queryRef, allowUntypedFrames);

  const showNoData =
    queryResponse.state === LoadingState.Done &&
    !(
      hasLogsData ||
      hasGraphData ||
      hasNodeGraphData ||
      hasFlameGraphData ||
      hasTableData ||
      hasRawPrometheusData ||
      hasTraceData ||
      hasCustomData
    );

  const onResize = useCallback(
    (size: HorizontalSize) => {
      dispatch(changeSize(exploreId, size));
    },
    [dispatch, exploreId]
  );

  return (
    <AutoSizer onResize={onResize} disableHeight>
      {({ width }) => {
        if (width === 0) {
          return null;
        }

        return (
          <main className={cx(styles.exploreMain)} style={{ width }}>
            <ErrorBoundaryAlert boundaryName="explore-main">
              {(() => {
                if (!showPanels) {
                  return null;
                }

                if (showCustom && hasCustomData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-custom-panel">
                      <RenderCustom
                        width={width}
                        exploreId={exploreId}
                        eventBus={eventBus}
                        onSplitOpen={onSplitOpen}
                        queryRef={queryRef}
                        allowUntypedFrames={allowUntypedFrames}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showNodeGraph && hasNodeGraphData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-node-graph-panel">
                      <RenderNodeGraphPanel
                        exploreId={exploreId}
                        showTrace={!!showTrace}
                        onSplitOpen={onSplitOpen}
                        queryRef={queryRef}
                        allowUntypedFrames={allowUntypedFrames}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showFlameGraph && hasFlameGraphData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-flame-graph-panel">
                      <RenderFlameGraphPanel
                        exploreId={exploreId}
                        queryRef={queryRef}
                        allowUntypedFrames={allowUntypedFrames}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showTrace && hasTraceData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-trace-view-panel">
                      <RenderTraceViewPanel
                        exploreId={exploreId}
                        onSplitOpen={onSplitOpen}
                        scrollElement={scrollElement}
                        queryRef={queryRef}
                        allowUntypedFrames={allowUntypedFrames}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showLogs && hasLogsData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-logs-panel">
                      <RenderLogsPanel
                        width={width}
                        exploreId={exploreId}
                        logsEventBus={logsEventBus}
                        onSplitOpen={onSplitOpen}
                        onClickFilterLabel={onClickFilterLabel}
                        onClickFilterOutLabel={onClickFilterOutLabel}
                        onClickFilterString={onClickFilterString}
                        onClickFilterOutString={onClickFilterOutString}
                        isFilterLabelActive={isFilterLabelActive}
                        onPinLineCallback={onPinLineCallback}
                        queryRef={queryRef}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showLogsSample) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-logs-sample-panel">
                      <RenderLogsSamplePanel exploreId={exploreId} onSplitOpen={onSplitOpen} />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showMetrics && graphResult && hasGraphData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-graph-panel">
                      <RenderGraphPanel
                        width={width}
                        graphResult={graphResult}
                        onSplitOpen={onSplitOpen}
                        exploreId={exploreId}
                        graphEventBus={graphEventBus}
                        showFlameGraph={!!showFlameGraph}
                        queryRef={queryRef}
                        allowUntypedFrames={allowUntypedFrames}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showRawPrometheus && hasRawPrometheusData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-raw-prometheus">
                      <RenderRawPrometheus
                        width={width}
                        exploreId={exploreId}
                        onSplitOpen={onSplitOpen}
                        onCellFilterAdded={onCellFilterAdded}
                        queryRef={queryRef}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showTable && hasTableData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-table-panel">
                      <RenderTablePanel
                        width={width}
                        exploreId={exploreId}
                        onSplitOpen={onSplitOpen}
                        onCellFilterAdded={onCellFilterAdded}
                        queryRef={queryRef}
                      />
                    </ErrorBoundaryAlert>
                  );
                }

                if (showNoData) {
                  return (
                    <ErrorBoundaryAlert boundaryName="explore-no-data">
                      <NoData />
                    </ErrorBoundaryAlert>
                  );
                }

                return null;
              })()}
            </ErrorBoundaryAlert>
          </main>
        );
      }}
    </AutoSizer>
  );
}

function RenderGraphPanel(props: {
  width: number;
  graphResult: DataFrame[] | null;
  showFlameGraph: boolean;
  onSplitOpen: (panelType: string) => SplitOpen;
  exploreId: string;
  graphEventBus: EventBus;
  queryRef: string;
  allowUntypedFrames: boolean;
}) {
  const { graphResult, showFlameGraph, width, onSplitOpen, exploreId, graphEventBus, queryRef, allowUntypedFrames } =
    props;

  const timeZone = useSelector(getTimeZoneSelector);
  const queryResponse = useQueryResponse(exploreId);
  const dispatch = useDispatch();
  const filteredGraphResult = useMemo(
    () => filterByQueryRef(graphResult ?? [], queryRef, allowUntypedFrames),
    [graphResult, queryRef, allowUntypedFrames]
  );

  const onUpdateTimeRange = useCallback(
    (absoluteRange: AbsoluteTimeRange) => {
      dispatch(updateTimeRange({ exploreId, absoluteRange }));
    },
    [exploreId, dispatch]
  );

  if (!filteredGraphResult.length) {
    return null;
  }

  return (
    <ContentOutlineItem panelId="Graph" title={t('explore.explore.title-graph', 'Graph')} icon="graph-bar">
      <GraphContainer
        data={filteredGraphResult}
        height={showFlameGraph ? 180 : 400}
        width={width}
        timeRange={queryResponse.timeRange}
        timeZone={timeZone}
        onChangeTime={onUpdateTimeRange}
        annotations={queryResponse.annotations}
        splitOpenFn={onSplitOpen('graph')}
        loadingState={queryResponse.state}
        eventBus={graphEventBus}
      />
    </ContentOutlineItem>
  );
}

function RenderRawPrometheus(props: {
  width: number;
  exploreId: string;
  onSplitOpen: (panelType: string) => SplitOpen;
  onCellFilterAdded: (filter: AdHocFilterItem) => void;
  queryRef: string;
}) {
  const { exploreId, width, onSplitOpen, onCellFilterAdded, queryRef } = props;
  const timeZone = useSelector(getTimeZoneSelector);
  const datasourceInstance = useDataSourceInstance(exploreId);

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
        onCellFilterAdded={datasourceInstance?.modifyQuery ? onCellFilterAdded : undefined}
        timeZone={timeZone}
        splitOpenFn={onSplitOpen('table')}
        queryRef={queryRef}
      />
    </ContentOutlineItem>
  );
}

function RenderTablePanel(props: {
  width: number;
  exploreId: string;
  onSplitOpen: (panelType: string) => SplitOpen;
  onCellFilterAdded: (filter: AdHocFilterItem) => void;
  queryRef: string;
}) {
  const { exploreId, width, onSplitOpen, onCellFilterAdded, queryRef } = props;
  const timeZone = useSelector(getTimeZoneSelector);

  return (
    <ContentOutlineItem panelId="Table" title={t('explore.explore.title-table', 'Table')} icon="table">
      <TableContainer
        ariaLabel={selectors.pages.Explore.General.table}
        width={width}
        exploreId={exploreId}
        onCellFilterAdded={onCellFilterAdded}
        timeZone={timeZone}
        splitOpenFn={onSplitOpen('table')}
        queryRef={queryRef}
      />
    </ContentOutlineItem>
  );
}

function RenderLogsPanel(props: {
  width: number;
  exploreId: string;
  logsEventBus: EventBus;
  onSplitOpen: (panelType: string) => SplitOpen;

  onClickFilterLabel: (key: string, value: string | number, frame?: DataFrame) => void;
  onClickFilterOutLabel: (key: string, value: string | number, frame?: DataFrame) => void;
  onClickFilterString: (value: string | number, refId?: string) => void;
  onClickFilterOutString: (value: string | number, refId?: string) => void;

  isFilterLabelActive: (key: string, value: string | number, refId?: string) => Promise<boolean>;

  onPinLineCallback: () => void;
  queryRef: string;
}) {
  const {
    exploreId,
    width,
    onClickFilterLabel,
    onClickFilterOutLabel,
    logsEventBus,
    onSplitOpen,
    isFilterLabelActive,
    onClickFilterString,
    onClickFilterOutString,
    onPinLineCallback,
    queryRef,
  } = props;

  const theme = useTheme2();
  const queryResponse = useQueryResponse(exploreId);
  const syncedTimes = useSelector(getSyncedTimesSelector);
  const dispatch = useDispatch();

  const onStartScanning = useCallback(() => {
    return dispatch(scanStart(exploreId));
  }, [exploreId, dispatch]);

  const onStopScanning = useCallback(() => {
    return dispatch(scanStopAction({ exploreId }));
  }, [exploreId, dispatch]);

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
        onClickFilterLabel={onClickFilterLabel}
        onClickFilterOutLabel={onClickFilterOutLabel}
        onStartScanning={onStartScanning}
        onStopScanning={onStopScanning}
        eventBus={logsEventBus}
        splitOpenFn={onSplitOpen('logs')}
        isFilterLabelActive={isFilterLabelActive}
        onClickFilterString={onClickFilterString}
        onClickFilterOutString={onClickFilterOutString}
        onPinLineCallback={onPinLineCallback}
        queryRef={queryRef}
      />
    </ContentOutlineItem>
  );
}

function RenderNodeGraphPanel(props: {
  exploreId: string;
  showTrace: boolean;
  onSplitOpen: (panelType: string) => SplitOpen;
  queryRef: string;
  allowUntypedFrames: boolean;
}) {
  const { exploreId, showTrace, onSplitOpen, queryRef, allowUntypedFrames } = props;

  const queryResponse = useQueryResponse(exploreId);
  const datasourceInstance = useDataSourceInstance(exploreId);
  const datasourceType = datasourceInstance ? datasourceInstance?.type : 'unknown';
  const dataFrames = useMemo(
    () => filterByQueryRef(queryResponse.nodeGraphFrames, queryRef, allowUntypedFrames),
    [queryResponse.nodeGraphFrames, queryRef, allowUntypedFrames]
  );

  if (!dataFrames.length) {
    return null;
  }

  return (
    <ContentOutlineItem
      panelId="Node Graph"
      title={t('explore.explore.title-node-graph', 'Node graph')}
      icon="code-branch"
    >
      <NodeGraphContainer
        dataFrames={dataFrames}
        exploreId={exploreId}
        withTraceView={showTrace}
        datasourceType={datasourceType}
        splitOpenFn={onSplitOpen('nodeGraph')}
      />
    </ContentOutlineItem>
  );
}

function RenderFlameGraphPanel(props: { exploreId: string; queryRef: string; allowUntypedFrames: boolean }) {
  const { exploreId, queryRef, allowUntypedFrames } = props;
  const queryResponse = useQueryResponse(exploreId);
  const frames = useMemo(
    () => filterByQueryRef(queryResponse.flameGraphFrames, queryRef, allowUntypedFrames),
    [queryResponse.flameGraphFrames, queryRef, allowUntypedFrames]
  );

  if (!frames.length) {
    return null;
  }
  return (
    <ContentOutlineItem panelId="Flame Graph" title={t('explore.explore.title-flame-graph', 'Flame graph')} icon="fire">
      <FlameGraphExploreContainer dataFrames={frames} />
    </ContentOutlineItem>
  );
}

function RenderTraceViewPanel(props: {
  exploreId: string;
  onSplitOpen: (panelType: string) => SplitOpen;
  scrollElement: HTMLDivElement | undefined;
  queryRef: string;
  allowUntypedFrames: boolean;
}) {
  const { exploreId, onSplitOpen, scrollElement, queryRef, allowUntypedFrames } = props;

  const queryResponse = useQueryResponse(exploreId);
  const dataFrames = useMemo(
    () =>
      queryResponse.series.filter(
        (series) =>
          series.meta?.preferredVisualisationType === 'trace' &&
          matchesQueryRef(series.refId, queryRef, allowUntypedFrames)
      ),
    [queryResponse.series, queryRef, allowUntypedFrames]
  );

  if (!dataFrames.length) {
    return null;
  }

  return (
    <ContentOutlineItem panelId="Traces" title={t('explore.explore.title-traces', 'Traces')} icon="file-alt">
      <TraceViewContainer
        exploreId={exploreId}
        dataFrames={dataFrames}
        splitOpenFn={onSplitOpen('traceView')}
        scrollElement={scrollElement}
        timeRange={queryResponse.timeRange}
      />
    </ContentOutlineItem>
  );
}

function RenderLogsSamplePanel(props: { exploreId: string; onSplitOpen: (panelType: string) => SplitOpen }) {
  const { exploreId, onSplitOpen } = props;

  const datasourceInstance = useDataSourceInstance(exploreId);
  const queryResponse = useQueryResponse(exploreId);
  const timeZone = useSelector(getTimeZoneSelector);
  const queries = useQueries(exploreId);
  const { logsSample } = useLogsSample(exploreId);
  const dispatch = useDispatch();
  const setLogsSampleEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setSupplementaryQueryEnabled(exploreId, enabled, SupplementaryQueryType.LogsSample));
    },
    [dispatch, exploreId]
  );

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
        splitOpen={onSplitOpen('logsSample')}
        setLogsSampleEnabled={setLogsSampleEnabled}
        timeRange={queryResponse.timeRange}
      />
    </ContentOutlineItem>
  );
}

function RenderCustom(props: {
  width: number;
  eventBus: EventBus;
  onSplitOpen: (panelType: string) => SplitOpen;
  exploreId: string;
  queryRef: string;
  allowUntypedFrames: boolean;
}) {
  const { eventBus, width, onSplitOpen, exploreId, queryRef, allowUntypedFrames } = props;
  const queryResponse = useQueryResponse(exploreId);
  const timeZone = useSelector(getTimeZoneSelector);
  const frames = useMemo(
    () => filterByQueryRef(queryResponse.customFrames, queryRef, allowUntypedFrames),
    [queryResponse.customFrames, queryRef, allowUntypedFrames]
  );

  if (!frames.length) {
    return null;
  }

  const groupedByPlugin = groupBy(frames, 'meta.preferredVisualisationPluginId');

  return Object.entries(groupedByPlugin).map(([pluginId, pluginFrames], index) => {
    return (
      <ContentOutlineItem panelId={pluginId} title={pluginId} icon="plug" key={pluginId}>
        <CustomContainer
          key={index}
          timeZone={timeZone}
          pluginId={pluginId}
          frames={pluginFrames}
          state={queryResponse.state}
          timeRange={queryResponse.timeRange}
          height={400}
          width={width}
          splitOpenFn={onSplitOpen(pluginId)}
          eventBus={eventBus}
        />
      </ContentOutlineItem>
    );
  });
}

function getTimeZoneSelector(state: StoreState) {
  return getTimeZone(state.user);
}

function getSyncedTimesSelector(state: StoreState) {
  return state.explore.syncedTimes;
}

function queryResponseSelector(exploreId: string) {
  return (state: StoreState) => {
    return state.explore.panes[exploreId]!.queryResponse;
  };
}

function queriesSelector(exploreId: string) {
  return (state: StoreState) => {
    return state.explore.panes[exploreId]!.queries;
  };
}

function dataSourceInstanceSelector(exploreId: string) {
  return (state: StoreState) => {
    return state.explore.panes[exploreId]!.datasourceInstance;
  };
}

function logsSampleSelector(exploreId: string) {
  const baseSelector = (state: StoreState) => state.explore.panes[exploreId]!;

  const selectLogsSample = createSelector(
    baseSelector,
    (exploreItem) => exploreItem.supplementaryQueries[SupplementaryQueryType.LogsSample]
  );

  const selectShowLogsSample = createSelector(baseSelector, selectLogsSample, (exploreItem, logsSample) => {
    const { logsResult, graphResult, tableResult } = exploreItem;
    return !!(logsSample.dataProvider !== undefined && !logsResult && (graphResult || tableResult));
  });

  return createSelector(selectLogsSample, selectShowLogsSample, (logsSample, showLogsSample) => {
    return { logsSample, showLogsSample };
  });
}

function showDataTypeSelector(exploreId: string) {
  const baseSelector = (state: StoreState) => state.explore.panes[exploreId]!;

  const selectShowLogs = createSelector(baseSelector, (exploreItem) => exploreItem.showLogs);
  const selectShowMetrics = createSelector(baseSelector, (exploreItem) => exploreItem.showMetrics);
  const selectShowTable = createSelector(baseSelector, (exploreItem) => exploreItem.showTable);
  const selectShowTrace = createSelector(baseSelector, (exploreItem) => exploreItem.showTrace);
  const selectShowCustom = createSelector(baseSelector, (exploreItem) => exploreItem.showCustom);
  const selectShowNodeGraph = createSelector(baseSelector, (exploreItem) => exploreItem.showNodeGraph);
  const selectShowRawPrometheus = createSelector(baseSelector, (exploreItem) => exploreItem.showRawPrometheus);
  const selectShowFlameGraph = createSelector(baseSelector, (exploreItem) => exploreItem.showFlameGraph);

  return createSelector(
    selectShowLogs,
    selectShowMetrics,
    selectShowTable,
    selectShowTrace,
    selectShowCustom,
    selectShowNodeGraph,
    selectShowRawPrometheus,
    selectShowFlameGraph,
    (showLogs, showMetrics, showTable, showTrace, showCustom, showNodeGraph, showRawPrometheus, showFlameGraph) => ({
      showLogs,
      showMetrics,
      showTable,
      showTrace,
      showCustom,
      showNodeGraph,
      showRawPrometheus,
      showFlameGraph,
    })
  );
}

function useQueryResponse(exploreId: string): ExplorePanelData {
  const queryResponseSelectorFinal = useMemo(() => queryResponseSelector(exploreId), [exploreId]);
  return useSelector(queryResponseSelectorFinal);
}

function useDataSourceInstance(exploreId: string) {
  const dataSourceInstanceSelectorFinal = useMemo(() => dataSourceInstanceSelector(exploreId), [exploreId]);
  return useSelector(dataSourceInstanceSelectorFinal);
}

function useQueries(exploreId: string) {
  const queriesSelectorFinal = useMemo(() => queriesSelector(exploreId), [exploreId]);
  return useSelector(queriesSelectorFinal);
}

function useLogsSample(exploreId: string) {
  const logsSampleSelectorFinal = useMemo(() => logsSampleSelector(exploreId), [exploreId]);
  return useSelector(logsSampleSelectorFinal);
}

function useShowDatatype(exploreId: string) {
  const showDataTypeSelectorFinal = useMemo(() => showDataTypeSelector(exploreId), [exploreId]);
  return useSelector(showDataTypeSelectorFinal);
}
