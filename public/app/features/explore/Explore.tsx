import React from 'react';
import { hot } from 'react-hot-loader';
import { css, cx } from '@emotion/css';
import { compose } from 'redux';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import memoizeOne from 'memoize-one';
import { selectors } from '@grafana/e2e-selectors';
import {
  ErrorBoundaryAlert,
  stylesFactory,
  withTheme,
  CustomScrollbar,
  Collapse,
  TooltipDisplayMode,
} from '@grafana/ui';
import {
  AbsoluteTimeRange,
  DataQuery,
  DataSourceApi,
  GrafanaTheme,
  LoadingState,
  PanelData,
  RawTimeRange,
  TimeZone,
  LogsModel,
  DataFrame,
} from '@grafana/data';

import LogsContainer from './LogsContainer';
import QueryRows from './QueryRows';
import TableContainer from './TableContainer';
import RichHistoryContainer from './RichHistory/RichHistoryContainer';
import ExploreQueryInspector from './ExploreQueryInspector';
import { splitOpen } from './state/main';
import { changeSize } from './state/explorePane';
import { updateTimeRange } from './state/time';
import { scanStopAction, addQueryRow, modifyQueries, setQueries, scanStart } from './state/query';
import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';
import { ExploreToolbar } from './ExploreToolbar';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { getTimeZone } from '../profile/state/selectors';
import { SecondaryActions } from './SecondaryActions';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, FilterItem } from '@grafana/ui/src/components/Table/types';
import { ExploreGraphNGPanel } from './ExploreGraphNGPanel';
import { NodeGraphContainer } from './NodeGraphContainer';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import { TraceViewContainer } from './TraceView/TraceViewContainer';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
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
      padding: ${theme.panelPadding}px;
    `,
  };
});

export interface ExploreProps {
  changeSize: typeof changeSize;
  datasourceInstance: DataSourceApi | null;
  datasourceMissing: boolean;
  exploreId: ExploreId;
  modifyQueries: typeof modifyQueries;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  scanStart: typeof scanStart;
  scanStopAction: typeof scanStopAction;
  setQueries: typeof setQueries;
  queryKeys: string[];
  isLive: boolean;
  syncedTimes: boolean;
  updateTimeRange: typeof updateTimeRange;
  graphResult: DataFrame[] | null;
  logsResult?: LogsModel;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
  queryResponse: PanelData;
  originPanelId: number;
  addQueryRow: typeof addQueryRow;
  theme: GrafanaTheme;
  loading: boolean;
  showMetrics: boolean;
  showTable: boolean;
  showLogs: boolean;
  showTrace: boolean;
  showNodeGraph: boolean;
  splitOpen: typeof splitOpen;
}

enum ExploreDrawer {
  RichHistory,
  QueryInspector,
}

interface ExploreState {
  openDrawer?: ExploreDrawer;
}

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
export class Explore extends React.PureComponent<ExploreProps, ExploreState> {
  constructor(props: ExploreProps) {
    super(props);
    this.state = {
      openDrawer: undefined,
    };
  }

  onChangeTime = (rawRange: RawTimeRange) => {
    const { updateTimeRange, exploreId } = this.props;
    updateTimeRange({ exploreId, rawRange });
  };

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    this.props.setQueries(this.props.exploreId, [query]);
  };

  onCellFilterAdded = (filter: FilterItem) => {
    const { value, key, operator } = filter;
    if (operator === FILTER_FOR_OPERATOR) {
      this.onClickFilterLabel(key, value);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      this.onClickFilterOutLabel(key, value);
    }
  };

  onClickFilterLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', key, value });
  };

  onClickFilterOutLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER_OUT', key, value });
  };

  onClickAddQueryRowButton = () => {
    const { exploreId, queryKeys } = this.props;
    this.props.addQueryRow(exploreId, queryKeys.length);
  };

  onModifyQueries = (action: any, index?: number) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance?.modifyQuery) {
      const modifier = (queries: DataQuery, modification: any) =>
        datasourceInstance.modifyQuery!(queries, modification);
      this.props.modifyQueries(this.props.exploreId, action, modifier, index);
    }
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

  renderEmptyState() {
    return (
      <div className="explore-container">
        <NoDataSourceCallToAction />
      </div>
    );
  }

  renderGraphPanel() {
    const { graphResult, absoluteRange, timeZone, splitOpen, queryResponse, loading } = this.props;
    return (
      <Collapse label="Graph" loading={loading} isOpen>
        <ExploreGraphNGPanel
          data={graphResult!}
          height={400}
          tooltipDisplayMode={TooltipDisplayMode.Single}
          absoluteRange={absoluteRange}
          timeZone={timeZone}
          onUpdateTimeRange={this.onUpdateTimeRange}
          annotations={queryResponse.annotations}
          splitOpenFn={splitOpen}
        />
      </Collapse>
    );
  }

  renderTablePanel(width: number) {
    const { exploreId, datasourceInstance } = this.props;
    return (
      <TableContainer
        ariaLabel={selectors.pages.Explore.General.table}
        width={width}
        exploreId={exploreId}
        onCellFilterAdded={datasourceInstance?.modifyQuery ? this.onCellFilterAdded : undefined}
      />
    );
  }

  renderLogsPanel() {
    const { exploreId, syncedTimes } = this.props;
    return (
      <LogsContainer
        exploreId={exploreId}
        syncedTimes={syncedTimes}
        onClickFilterLabel={this.onClickFilterLabel}
        onClickFilterOutLabel={this.onClickFilterOutLabel}
        onStartScanning={this.onStartScanning}
        onStopScanning={this.onStopScanning}
      />
    );
  }

  renderNodeGraphPanel() {
    const { exploreId, showTrace, queryResponse } = this.props;
    return (
      <NodeGraphContainer
        dataFrames={this.getNodeGraphDataFrames(queryResponse.series)}
        exploreId={exploreId}
        withTraceView={showTrace}
      />
    );
  }

  getNodeGraphDataFrames = memoizeOne((frames: DataFrame[]) => {
    // TODO: this not in sync with how other types of responses are handled. Other types have a query response
    //  processing pipeline which ends up populating redux state with proper data. As we move towards more dataFrame
    //  oriented API it seems like a better direction to move such processing into to visualisations and do minimal
    //  and lazy processing here. Needs bigger refactor so keeping nodeGraph and Traces as they are for now.
    return frames.filter((frame) => frame.meta?.preferredVisualisationType === 'nodeGraph');
  });

  renderTraceViewPanel() {
    const { queryResponse, splitOpen, exploreId } = this.props;
    const dataFrames = queryResponse.series.filter((series) => series.meta?.preferredVisualisationType === 'trace');

    return (
      // If there is no data (like 404) we show a separate error so no need to show anything here
      dataFrames.length && <TraceViewContainer exploreId={exploreId} dataFrames={dataFrames} splitOpenFn={splitOpen} />
    );
  }

  render() {
    const {
      datasourceInstance,
      datasourceMissing,
      exploreId,
      queryKeys,
      graphResult,
      queryResponse,
      isLive,
      theme,
      showMetrics,
      showTable,
      showLogs,
      showTrace,
      showNodeGraph,
    } = this.props;
    const { openDrawer } = this.state;
    const styles = getStyles(theme);
    const showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;
    const showRichHistory = openDrawer === ExploreDrawer.RichHistory;
    const showQueryInspector = openDrawer === ExploreDrawer.QueryInspector;

    return (
      <CustomScrollbar autoHeightMin={'100%'}>
        <ExploreToolbar exploreId={exploreId} onChangeTime={this.onChangeTime} />
        {datasourceMissing ? this.renderEmptyState() : null}
        {datasourceInstance && (
          <div className="explore-container">
            <div className={cx('panel-container', styles.queryContainer)}>
              <QueryRows exploreId={exploreId} queryKeys={queryKeys} />
              <SecondaryActions
                addQueryRowButtonDisabled={isLive}
                // We cannot show multiple traces at the same time right now so we do not show add query button.
                //TODO:unification
                addQueryRowButtonHidden={false}
                richHistoryButtonActive={showRichHistory}
                queryInspectorButtonActive={showQueryInspector}
                onClickAddQueryRowButton={this.onClickAddQueryRowButton}
                onClickRichHistoryButton={this.toggleShowRichHistory}
                onClickQueryInspectorButton={this.toggleShowQueryInspector}
              />
              <ResponseErrorContainer exploreId={exploreId} />
            </div>
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
                            <ErrorBoundaryAlert>{this.renderGraphPanel()}</ErrorBoundaryAlert>
                          )}
                          {showTable && <ErrorBoundaryAlert>{this.renderTablePanel(width)}</ErrorBoundaryAlert>}
                          {showLogs && <ErrorBoundaryAlert>{this.renderLogsPanel()}</ErrorBoundaryAlert>}
                          {showNodeGraph && <ErrorBoundaryAlert>{this.renderNodeGraphPanel()}</ErrorBoundaryAlert>}
                          {showTrace && <ErrorBoundaryAlert>{this.renderTraceViewPanel()}</ErrorBoundaryAlert>}
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

function mapStateToProps(state: StoreState, { exploreId }: ExploreProps): Partial<ExploreProps> {
  const explore = state.explore;
  const { syncedTimes } = explore;
  const item: ExploreItemState = explore[exploreId]!;
  const timeZone = getTimeZone(state.user);
  const {
    datasourceInstance,
    datasourceMissing,
    queryKeys,
    isLive,
    graphResult,
    logsResult,
    showLogs,
    showMetrics,
    showTable,
    showTrace,
    absoluteRange,
    queryResponse,
    showNodeGraph,
    loading,
  } = item;

  return {
    datasourceInstance,
    datasourceMissing,
    queryKeys,
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
    loading,
  };
}

const mapDispatchToProps: Partial<ExploreProps> = {
  changeSize,
  modifyQueries,
  scanStart,
  scanStopAction,
  setQueries,
  updateTimeRange,
  addQueryRow,
  splitOpen,
};

export default compose(
  hot(module),
  connect(mapStateToProps, mapDispatchToProps),
  withTheme
)(Explore) as React.ComponentType<{ exploreId: ExploreId }>;
