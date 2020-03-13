// Libraries
import React from 'react';
import { hot } from 'react-hot-loader';
import { css, cx } from 'emotion';
import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import memoizeOne from 'memoize-one';
import { TraceTimelineViewer, Trace, Span, Log, KeyValuePair, Link } from '@jaegertracing/jaeger-ui-components';

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
import { ViewRangeTimeUpdate } from '@jaegertracing/jaeger-ui-components/dist/TraceTimelineViewer/types';
import TTraceTimeline from '@jaegertracing/jaeger-ui-components/dist/types/TTraceTimeline';

const getStyles = stylesFactory(() => {
  return {
    logsMain: css`
      label: logsMain;
      // Is needed for some transition animations to work.
      position: relative;
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
                disabled={isLive}
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
                  <main className={cx('m-t-2', styles.logsMain, styles.fullHeight)} style={{ width }}>
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
                            <TraceTimelineViewer
                              registerAccessors={() => {}}
                              scrollToFirstVisibleSpan={() => {}}
                              findMatchesIDs={null}
                              trace={makeTrace()}
                              traceTimeline={
                                {
                                  childrenHiddenIDs: {},
                                  detailStates: {},
                                  hoverIndentGuideIds: {},
                                  shouldScrollToFirstUiFindMatch: false,
                                  spanNameColumnWidth: 0.25,
                                  traceID: '50b96206cf81dd64',
                                } as TTraceTimeline
                              }
                              updateNextViewRangeTime={(update: ViewRangeTimeUpdate) => {}}
                              updateViewRangeTime={() => {}}
                              viewRange={{ time: { current: [0, 1], cursor: null } }}
                              focusSpan={() => {}}
                              createLinkToExternalSpan={() => ''}
                              setSpanNameColumnWidth={(width: number) => {}}
                              collapseAll={(spans: Span[]) => {}}
                              collapseOne={(spans: Span[]) => {}}
                              expandAll={() => {}}
                              expandOne={(spans: Span[]) => {}}
                              childrenToggle={(spanID: string) => {}}
                              clearShouldScrollToFirstUiFindMatch={() => {}}
                              detailLogItemToggle={(spanID: string, log: Log) => {}}
                              detailLogsToggle={(spanID: string) => {}}
                              detailWarningsToggle={(spanID: string) => {}}
                              detailReferencesToggle={(spanID: string) => {}}
                              detailProcessToggle={(spanID: string) => {}}
                              detailTagsToggle={(spanID: string) => {}}
                              detailToggle={(spanID: string) => {}}
                              setTrace={(trace: Trace | null, uiFind: string | null) => {}}
                              addHoverIndentGuideId={(spanID: string) => {}}
                              removeHoverIndentGuideId={(spanID: string) => {}}
                              linksGetter={(span: Span, items: KeyValuePair[], itemIndex: number) => [] as Link[]}
                              uiFind={undefined}
                            />
                          )}
                        </>
                      )}
                      {showRichHistory && <RichHistoryContainer width={width} exploreId={exploreId} />}
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

function makeTrace(): Trace {
  return {
    services: [{ name: 'loki-all', numberOfSpans: 3 }],
    spans: [
      {
        traceID: '50b96206cf81dd64',
        spanID: '50b96206cf81dd64',
        operationName: 'HTTP POST - api_prom_push',
        references: [] as any,
        startTime: 1584051626572058,
        duration: 763,
        tags: [
          { key: 'component', value: 'net/http' },
          { key: 'http.method', value: 'POST' },
          { key: 'http.status_code', value: 204 },
          { key: 'http.url', value: '/api/prom/push' },
          { key: 'internal.span.format', value: 'proto' },
          { key: 'sampler.param', value: true },
          { key: 'sampler.type', value: 'const' },
          { key: 'span.kind', value: 'server' },
        ],
        logs: [
          {
            timestamp: 1584051626572105,
            fields: [{ key: 'event', value: 'util.ParseProtoRequest[start reading]' }],
          },
          {
            timestamp: 1584051626572118,
            fields: [
              { key: 'event', value: 'util.ParseProtoRequest[decompress]' },
              { key: 'size', value: 330 },
            ],
          },
          {
            timestamp: 1584051626572122,
            fields: [
              { key: 'event', value: 'util.ParseProtoRequest[unmarshal]' },
              { key: 'size', value: 500 },
            ],
          },
        ],
        processID: 'p1',
        warnings: [] as any,
        process: {
          serviceName: 'loki-all',
          tags: [
            { key: 'client-uuid', value: '36e1d270cb524d68' },
            { key: 'hostname', value: '33dc62b13c67' },
            { key: 'ip', value: '172.18.0.5' },
            { key: 'jaeger.version', value: 'Go-2.20.1' },
          ],
        },
        relativeStartTime: 0,
        depth: 0,
        hasChildren: true,
        subsidiarilyReferencedBy: [] as any,
      },
      {
        traceID: '50b96206cf81dd64',
        spanID: '53cdf5cabb2f1390',
        operationName: '/logproto.Pusher/Push',
        references: [{ refType: 'CHILD_OF', traceID: '50b96206cf81dd64', spanID: '50b96206cf81dd64', span: undefined }],
        startTime: 1584051626572235,
        duration: 550,
        tags: [
          { key: 'component', value: 'gRPC' },
          { key: 'internal.span.format', value: 'proto' },
          { key: 'span.kind', value: 'client' },
        ],
        logs: [] as any,
        processID: 'p1',
        warnings: [] as any,
        relativeStartTime: 177,
        depth: 1,
        hasChildren: true,
        subsidiarilyReferencedBy: [] as any,
        process: {
          serviceName: 'loki-all',
          tags: [
            { key: 'client-uuid', value: '36e1d270cb524d68' },
            { key: 'hostname', value: '33dc62b13c67' },
            { key: 'ip', value: '172.18.0.5' },
            { key: 'jaeger.version', value: 'Go-2.20.1' },
          ],
        },
      },
      {
        traceID: '50b96206cf81dd64',
        spanID: '0eca9ed08e8477ae',
        operationName: '/logproto.Pusher/Push',
        references: [{ refType: 'CHILD_OF', traceID: '50b96206cf81dd64', spanID: '53cdf5cabb2f1390', span: undefined }],
        startTime: 1584051626572582,
        duration: 32,
        tags: [
          { key: 'component', value: 'gRPC' },
          { key: 'internal.span.format', value: 'proto' },
          { key: 'span.kind', value: 'server' },
        ],
        logs: [],
        processID: 'p1',
        warnings: [],
        relativeStartTime: 524,
        depth: 2,
        hasChildren: false,
        subsidiarilyReferencedBy: [] as any,
        process: {
          serviceName: 'loki-all',
          tags: [
            { key: 'client-uuid', value: '36e1d270cb524d68' },
            { key: 'hostname', value: '33dc62b13c67' },
            { key: 'ip', value: '172.18.0.5' },
            { key: 'jaeger.version', value: 'Go-2.20.1' },
          ],
        },
      },
    ],
    traceID: '50b96206cf81dd64',
    traceName: 'loki-all: HTTP POST - api_prom_push',
    processes: {},
    duration: 763,
    startTime: 1584051626572058,
    endTime: 1584051626572821,
  };
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
