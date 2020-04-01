// Libraries
import React from 'react';
import { hot } from 'react-hot-loader';
import { css, cx } from 'emotion';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import memoizeOne from 'memoize-one';

// Services & Utils
import store from 'app/core/store';

// Components
import { ErrorBoundaryAlert, stylesFactory } from '@grafana/ui';
import LogsContainer from './LogsContainer';
import QueryRows from './QueryRows';
import TableContainer from './TableContainer';
import RichHistoryContainer from './RichHistory/RichHistoryContainer';
// Actions
import {
  changeSize,
  initializeExplore,
  modifyQueries,
  refreshExplore,
  scanStart,
  setQueries,
  toggleGraph,
  addQueryRow,
  updateTimeRange,
} from './state/actions';
// Types
import {
  AbsoluteTimeRange,
  DataQuery,
  DataSourceApi,
  GraphSeriesXY,
  PanelData,
  RawTimeRange,
  TimeRange,
  TimeZone,
  LoadingState,
  ExploreMode,
} from '@grafana/data';

import { ExploreId, ExploreItemState, ExploreUIState, ExploreUpdateState, ExploreUrlState } from 'app/types/explore';
import { StoreState } from 'app/types';
import {
  DEFAULT_RANGE,
  DEFAULT_UI_STATE,
  ensureQueries,
  getTimeRangeFromUrl,
  getTimeRange,
  lastUsedDatasourceKeyForOrgId,
  getFirstNonQueryRowSpecificError,
} from 'app/core/utils/explore';
import { Emitter } from 'app/core/utils/emitter';
import { ExploreToolbar } from './ExploreToolbar';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { getTimeZone } from '../profile/state/selectors';
import { ErrorContainer } from './ErrorContainer';
import { scanStopAction } from './state/actionTypes';
import { ExploreGraphPanel } from './ExploreGraphPanel';

const getStyles = stylesFactory(() => {
  return {
    logsMain: css`
      label: logsMain;
      // Is needed for some transition animations to work.
      position: relative;
      margin-top: 21px;
    `,
    button: css`
      margin: 1em 4px 0 0;
    `,
    // Utility class for iframe parents so that we can show iframe content with reasonable height instead of squished
    // or some random explicit height.
    fullHeight: css`
      label: fullHeight;
      height: 100%;
    `,
    iframe: css`
      label: iframe;
      border: none;
      width: 100%;
      height: 100%;
    `,
  };
});

export interface ExploreProps {
  changeSize: typeof changeSize;
  datasourceInstance: DataSourceApi;
  datasourceMissing: boolean;
  exploreId: ExploreId;
  initializeExplore: typeof initializeExplore;
  initialized: boolean;
  modifyQueries: typeof modifyQueries;
  update: ExploreUpdateState;
  refreshExplore: typeof refreshExplore;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  scanStart: typeof scanStart;
  scanStopAction: typeof scanStopAction;
  setQueries: typeof setQueries;
  split: boolean;
  queryKeys: string[];
  initialDatasource: string;
  initialQueries: DataQuery[];
  initialRange: TimeRange;
  mode: ExploreMode;
  initialUI: ExploreUIState;
  isLive: boolean;
  syncedTimes: boolean;
  updateTimeRange: typeof updateTimeRange;
  graphResult?: GraphSeriesXY[];
  loading?: boolean;
  absoluteRange: AbsoluteTimeRange;
  showingGraph?: boolean;
  showingTable?: boolean;
  timeZone?: TimeZone;
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
  toggleGraph: typeof toggleGraph;
  queryResponse: PanelData;
  originPanelId: number;
  addQueryRow: typeof addQueryRow;
}

interface ExploreState {
  showRichHistory: boolean;
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
  el: any;
  exploreEvents: Emitter;

  constructor(props: ExploreProps) {
    super(props);
    this.exploreEvents = new Emitter();
    this.state = {
      showRichHistory: false,
    };
  }

  componentDidMount() {
    const {
      initialized,
      exploreId,
      initialDatasource,
      initialQueries,
      initialRange,
      mode,
      initialUI,
      originPanelId,
    } = this.props;
    const width = this.el ? this.el.offsetWidth : 0;

    // initialize the whole explore first time we mount and if browser history contains a change in datasource
    if (!initialized) {
      this.props.initializeExplore(
        exploreId,
        initialDatasource,
        initialQueries,
        initialRange,
        mode,
        width,
        this.exploreEvents,
        initialUI,
        originPanelId
      );
    }
  }

  componentWillUnmount() {
    this.exploreEvents.removeAllListeners();
  }

  componentDidUpdate(prevProps: ExploreProps) {
    this.refreshExplore();
  }

  getRef = (el: any) => {
    this.el = el;
  };

  onChangeTime = (rawRange: RawTimeRange) => {
    const { updateTimeRange, exploreId } = this.props;
    updateTimeRange({ exploreId, rawRange });
  };

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    this.props.setQueries(this.props.exploreId, [query]);
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

  onToggleGraph = (showingGraph: boolean) => {
    const { toggleGraph, exploreId } = this.props;
    toggleGraph(exploreId, showingGraph);
  };

  onUpdateTimeRange = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
  };

  toggleShowRichHistory = () => {
    this.setState(state => {
      return {
        showRichHistory: !state.showRichHistory,
      };
    });
  };

  refreshExplore = () => {
    const { exploreId, update } = this.props;

    if (update.queries || update.ui || update.range || update.datasource || update.mode) {
      this.props.refreshExplore(exploreId);
    }
  };

  renderEmptyState = () => {
    return (
      <div className="explore-container">
        <NoDataSourceCallToAction />
      </div>
    );
  };

  render() {
    const {
      datasourceInstance,
      datasourceMissing,
      exploreId,
      split,
      queryKeys,
      mode,
      graphResult,
      loading,
      absoluteRange,
      showingGraph,
      showingTable,
      timeZone,
      queryResponse,
      syncedTimes,
      isLive,
    } = this.props;
    const { showRichHistory } = this.state;
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const styles = getStyles();
    const StartPage = datasourceInstance?.components?.ExploreStartPage;
    const showStartPage = !queryResponse || queryResponse.state === LoadingState.NotStarted;

    // gets an error without a refID, so non-query-row-related error, like a connection error
    const queryErrors = queryResponse.error ? [queryResponse.error] : undefined;
    const queryError = getFirstNonQueryRowSpecificError(queryErrors);

    return (
      <div className={exploreClass} ref={this.getRef}>
        <ExploreToolbar exploreId={exploreId} onChangeTime={this.onChangeTime} />
        {datasourceMissing ? this.renderEmptyState() : null}
        {datasourceInstance && (
          <div className="explore-container">
            <QueryRows exploreEvents={this.exploreEvents} exploreId={exploreId} queryKeys={queryKeys} />
            <div className="gf-form">
              <button
                aria-label="Add row button"
                className={`gf-form-label gf-form-label--btn ${styles.button}`}
                onClick={this.onClickAddQueryRowButton}
                disabled={isLive}
              >
                <i className={'fa fa-fw fa-plus icon-margin-right'} />
                <span className="btn-title">{'\xA0' + 'Add query'}</span>
              </button>
              <button
                aria-label="Rich history button"
                className={cx(`gf-form-label gf-form-label--btn ${styles.button}`, {
                  ['explore-active-button']: showRichHistory,
                })}
                onClick={this.toggleShowRichHistory}
              >
                <i className={'fa fa-fw fa-history icon-margin-right '} />
                <span className="btn-title">{'\xA0' + 'Query history'}</span>
              </button>
            </div>
            <ErrorContainer queryError={queryError} />
            <AutoSizer className={styles.fullHeight} onResize={this.onResize} disableHeight>
              {({ width }) => {
                if (width === 0) {
                  return null;
                }

                return (
                  <main
                    className={cx(
                      styles.logsMain,
                      // We need height to be 100% for tracing iframe to look good but in case of metrics mode
                      // it makes graph and table also full page high when they do not need to be.
                      mode === ExploreMode.Tracing && styles.fullHeight
                    )}
                    style={{ width }}
                  >
                    <ErrorBoundaryAlert>
                      {showStartPage && StartPage && (
                        <div className={'grafana-info-box grafana-info-box--max-lg'}>
                          <StartPage
                            onClickExample={this.onClickExample}
                            datasource={datasourceInstance}
                            exploreMode={mode}
                          />
                        </div>
                      )}
                      {!showStartPage && (
                        <>
                          {mode === ExploreMode.Metrics && (
                            <ExploreGraphPanel
                              series={graphResult}
                              width={width}
                              loading={loading}
                              absoluteRange={absoluteRange}
                              isStacked={false}
                              showPanel={true}
                              showingGraph={showingGraph}
                              showingTable={showingTable}
                              timeZone={timeZone}
                              onToggleGraph={this.onToggleGraph}
                              onUpdateTimeRange={this.onUpdateTimeRange}
                              showBars={false}
                              showLines={true}
                            />
                          )}
                          {mode === ExploreMode.Metrics && (
                            <TableContainer width={width} exploreId={exploreId} onClickCell={this.onClickFilterLabel} />
                          )}
                          {mode === ExploreMode.Logs && (
                            <LogsContainer
                              width={width}
                              exploreId={exploreId}
                              syncedTimes={syncedTimes}
                              onClickFilterLabel={this.onClickFilterLabel}
                              onClickFilterOutLabel={this.onClickFilterOutLabel}
                              onStartScanning={this.onStartScanning}
                              onStopScanning={this.onStopScanning}
                            />
                          )}
                          {mode === ExploreMode.Tracing && (
                            <div className={styles.fullHeight}>
                              {queryResponse &&
                                !!queryResponse.series.length &&
                                queryResponse.series[0].fields[0].values.get(0) && (
                                  <iframe
                                    className={styles.iframe}
                                    src={queryResponse.series[0].fields[0].values.get(0)}
                                  />
                                )}
                            </div>
                          )}
                        </>
                      )}
                      {showRichHistory && (
                        <RichHistoryContainer
                          width={width}
                          exploreId={exploreId}
                          onClose={this.toggleShowRichHistory}
                        />
                      )}
                    </ErrorBoundaryAlert>
                  </main>
                );
              }}
            </AutoSizer>
          </div>
        )}
      </div>
    );
  }
}

const ensureQueriesMemoized = memoizeOne(ensureQueries);
const getTimeRangeFromUrlMemoized = memoizeOne(getTimeRangeFromUrl);

function mapStateToProps(state: StoreState, { exploreId }: ExploreProps): Partial<ExploreProps> {
  const explore = state.explore;
  const { split, syncedTimes } = explore;
  const item: ExploreItemState = explore[exploreId];
  const timeZone = getTimeZone(state.user);
  const {
    datasourceInstance,
    datasourceMissing,
    initialized,
    queryKeys,
    urlState,
    update,
    isLive,
    supportedModes,
    mode,
    graphResult,
    loading,
    showingGraph,
    showingTable,
    absoluteRange,
    queryResponse,
  } = item;

  const { datasource, queries, range: urlRange, mode: urlMode, ui, originPanelId } = (urlState ||
    {}) as ExploreUrlState;
  const initialDatasource = datasource || store.get(lastUsedDatasourceKeyForOrgId(state.user.orgId));
  const initialQueries: DataQuery[] = ensureQueriesMemoized(queries);
  const initialRange = urlRange
    ? getTimeRangeFromUrlMemoized(urlRange, timeZone)
    : getTimeRange(timeZone, DEFAULT_RANGE);

  let newMode: ExploreMode | undefined;

  if (supportedModes.length) {
    const urlModeIsValid = supportedModes.includes(urlMode);
    const modeStateIsValid = supportedModes.includes(mode);

    if (modeStateIsValid) {
      newMode = mode;
    } else if (urlModeIsValid) {
      newMode = urlMode;
    } else {
      newMode = supportedModes[0];
    }
  } else {
    newMode = [ExploreMode.Metrics, ExploreMode.Logs, ExploreMode.Tracing].includes(urlMode) ? urlMode : undefined;
  }

  const initialUI = ui || DEFAULT_UI_STATE;

  return {
    datasourceInstance,
    datasourceMissing,
    initialized,
    split,
    queryKeys,
    update,
    initialDatasource,
    initialQueries,
    initialRange,
    mode: newMode,
    initialUI,
    isLive,
    graphResult,
    loading,
    showingGraph,
    showingTable,
    absoluteRange,
    queryResponse,
    originPanelId,
    syncedTimes,
    timeZone,
  };
}

const mapDispatchToProps: Partial<ExploreProps> = {
  changeSize,
  initializeExplore,
  modifyQueries,
  refreshExplore,
  scanStart,
  scanStopAction,
  setQueries,
  updateTimeRange,
  toggleGraph,
  addQueryRow,
};

export default hot(module)(
  // @ts-ignore
  connect(mapStateToProps, mapDispatchToProps)(Explore)
) as React.ComponentType<{ exploreId: ExploreId }>;
