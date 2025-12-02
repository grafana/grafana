import { css, cx } from '@emotion/css';
import { createSelector } from '@reduxjs/toolkit';
import { groupBy } from 'lodash';
import { useCallback } from 'react';
import AutoSizer, { HorizontalSize } from 'react-virtualized-auto-sizer';

import {
  AbsoluteTimeRange,
  DataFrame,
  EventBus,
  GrafanaTheme2,
  SplitOpen,
  SupplementaryQueryType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { AdHocFilterItem, ErrorBoundaryAlert, useTheme2 } from '@grafana/ui';

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

type Props = {
  onSplitOpen: (panelType: string) => SplitOpen;
  graphResult: DataFrame[] | null;
  exploreId: string;

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
    }),
  };
};

export function RenderResults(props: Props) {
  const {
    onSplitOpen,
    graphResult,
    exploreId,
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
  const {
    showLogs,
    showLogsSample,
    showPanels,
    showCustom,
    showMetrics,
    showNoData,
    showTable,
    showNodeGraph,
    showRawPrometheus,
    showFlameGraph,
    showTrace,
  } = useShowDatatype(exploreId);
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
              {showPanels && (
                <>
                  {showMetrics && graphResult && (
                    <ErrorBoundaryAlert boundaryName="explore-graph-panel">
                      <RenderGraphPanel
                        width={width}
                        graphResult={graphResult}
                        onSplitOpen={onSplitOpen}
                        exploreId={exploreId}
                        graphEventBus={graphEventBus}
                        showFlameGraph={showFlameGraph}
                      />
                    </ErrorBoundaryAlert>
                  )}
                  {showRawPrometheus && (
                    <ErrorBoundaryAlert boundaryName="explore-raw-prometheus">
                      <RenderRawPrometheus
                        width={width}
                        exploreId={exploreId}
                        onSplitOpen={onSplitOpen}
                        onCellFilterAdded={onCellFilterAdded}
                      />
                    </ErrorBoundaryAlert>
                  )}
                  {showTable && (
                    <ErrorBoundaryAlert boundaryName="explore-table-panel">
                      <RenderTablePanel
                        width={width}
                        exploreId={exploreId}
                        onSplitOpen={onSplitOpen}
                        onCellFilterAdded={onCellFilterAdded}
                      />
                    </ErrorBoundaryAlert>
                  )}
                  {showLogs && (
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
                      />
                    </ErrorBoundaryAlert>
                  )}
                  {showNodeGraph && (
                    <ErrorBoundaryAlert boundaryName="explore-node-graph-panel">
                      <RenderNodeGraphPanel exploreId={exploreId} showTrace={showTrace} onSplitOpen={onSplitOpen} />
                    </ErrorBoundaryAlert>
                  )}
                  {showFlameGraph && (
                    <ErrorBoundaryAlert boundaryName="explore-flame-graph-panel">
                      <RenderFlameGraphPanel exploreId={exploreId} />
                    </ErrorBoundaryAlert>
                  )}
                  {showTrace && (
                    <ErrorBoundaryAlert boundaryName="explore-trace-view-panel">
                      <RenderTraceViewPanel
                        exploreId={exploreId}
                        onSplitOpen={onSplitOpen}
                        scrollElement={scrollElement}
                      />
                    </ErrorBoundaryAlert>
                  )}
                  {showLogsSample && (
                    <ErrorBoundaryAlert boundaryName="explore-logs-sample-panel">
                      <RenderLogsSamplePanel exploreId={exploreId} onSplitOpen={onSplitOpen} />
                    </ErrorBoundaryAlert>
                  )}
                  {showCustom && (
                    <ErrorBoundaryAlert boundaryName="explore-custom-panel">
                      <RenderCustom width={width} exploreId={exploreId} eventBus={eventBus} onSplitOpen={onSplitOpen} />
                    </ErrorBoundaryAlert>
                  )}
                  {showNoData && (
                    <ErrorBoundaryAlert boundaryName="explore-no-data">
                      <NoData />
                    </ErrorBoundaryAlert>
                  )}
                </>
              )}
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
}) {
  const { graphResult, showFlameGraph, width, onSplitOpen, exploreId, graphEventBus } = props;

  const timeZone = useSelector(getTimeZoneSelector);
  const queryResponse = useQueryResponse(exploreId);
  const dispatch = useDispatch();

  const onUpdateTimeRange = useCallback(
    (absoluteRange: AbsoluteTimeRange) => {
      dispatch(updateTimeRange({ exploreId, absoluteRange }));
    },
    [exploreId, dispatch]
  );

  return (
    <ContentOutlineItem panelId="Graph" title={t('explore.explore.title-graph', 'Graph')} icon="graph-bar">
      <GraphContainer
        data={graphResult!}
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
}) {
  const { exploreId, width, onSplitOpen, onCellFilterAdded } = props;
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
      />
    </ContentOutlineItem>
  );
}

function RenderTablePanel(props: {
  width: number;
  exploreId: string;
  onSplitOpen: (panelType: string) => SplitOpen;
  onCellFilterAdded: (filter: AdHocFilterItem) => void;
}) {
  const { exploreId, width, onSplitOpen, onCellFilterAdded } = props;
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
      />
    </ContentOutlineItem>
  );
}

function RenderNodeGraphPanel(props: {
  exploreId: string;
  showTrace: boolean;
  onSplitOpen: (panelType: string) => SplitOpen;
}) {
  const { exploreId, showTrace, onSplitOpen } = props;

  const queryResponse = useQueryResponse(exploreId);
  const datasourceInstance = useDataSourceInstance(exploreId);
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
        splitOpenFn={onSplitOpen('nodeGraph')}
      />
    </ContentOutlineItem>
  );
}

function RenderFlameGraphPanel(props: { exploreId: string }) {
  const { exploreId } = props;
  const queryResponse = useQueryResponse(exploreId);
  return (
    <ContentOutlineItem panelId="Flame Graph" title={t('explore.explore.title-flame-graph', 'Flame graph')} icon="fire">
      <FlameGraphExploreContainer dataFrames={queryResponse.flameGraphFrames} />
    </ContentOutlineItem>
  );
}

function RenderTraceViewPanel(props: {
  exploreId: string;
  onSplitOpen: (panelType: string) => SplitOpen;
  scrollElement: HTMLDivElement | undefined;
}) {
  const { exploreId, onSplitOpen, scrollElement } = props;

  const queryResponse = useQueryResponse(exploreId);
  const dataFrames = queryResponse.series.filter((series) => series.meta?.preferredVisualisationType === 'trace');

  return (
    // If there is no data (like 404) we show a separate error so no need to show anything here
    dataFrames.length && (
      <ContentOutlineItem panelId="Traces" title={t('explore.explore.title-traces', 'Traces')} icon="file-alt">
        <TraceViewContainer
          exploreId={exploreId}
          dataFrames={dataFrames}
          splitOpenFn={onSplitOpen('traceView')}
          scrollElement={scrollElement}
          timeRange={queryResponse.timeRange}
        />
      </ContentOutlineItem>
    )
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
}) {
  const { eventBus, width, onSplitOpen, exploreId } = props;
  const queryResponse = useQueryResponse(exploreId);
  const timeZone = useSelector(getTimeZoneSelector);

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

function queryResponseSelector(exploreId) {
  return (state: StoreState) => {
    return state.explore.items[exploreId].queryResponse;
  };
}

function queriesSelector(exploreId) {
  return (state: StoreState) => {
    return state.explore.items[exploreId].queries;
  };
}

function dataSourceInstanceSelector(exploreId) {
  return (state: StoreState) => {
    return state.explore.items[exploreId].queryResponse;
  };
}

function logsSampleSelector(exploreId: string) {
  const baseSelector = (state: StoreState) => state.explore[exploreId];

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
  const baseSelector = (state: StoreState) => state.explore[exploreId];

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

function useQueryResponse(exploreId: string) {
  const queryResponseSelectorFinal = useCallback(() => {
    return queryResponseSelector(exploreId);
  }, [exploreId]);
  return useSelector(queryResponseSelectorFinal);
}

function useDataSourceInstance(exploreId: string) {
  const dataSourceInstanceSelectorFinal = useCallback(() => {
    return dataSourceInstanceSelector(exploreId);
  }, [exploreId]);
  return useSelector(dataSourceInstanceSelectorFinal);
}

function useQueries(exploreId: string) {
  const queriesSelectorFinal = useCallback(() => {
    return queriesSelector(exploreId);
  }, [exploreId]);
  return useSelector(queriesSelectorFinal);
}

function useLogsSample(exploreId: string) {
  const logsSampleSelectorFinal = useCallback(() => {
    return logsSampleSelector(exploreId);
  }, [exploreId]);
  return useSelector(logsSampleSelectorFinal);
}

function useShowDatatype(exploreId: string) {
  const showDataTypeSelectorFinal = useCallback(() => {
    return showDataTypeSelector(exploreId);
  }, [exploreId]);
  return useSelector(showDataTypeSelectorFinal);
}
