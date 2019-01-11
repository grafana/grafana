import React from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import _ from 'lodash';
import { AutoSizer } from 'react-virtualized';
import { RawTimeRange, TimeRange } from '@grafana/ui';

import { DataSourceSelectItem } from 'app/types/datasources';
import { ExploreUrlState, HistoryItem, QueryTransaction, RangeScanner, ExploreId } from 'app/types/explore';
import { DataQuery } from 'app/types/series';
import { StoreState } from 'app/types';
import store from 'app/core/store';
import { LAST_USED_DATASOURCE_KEY, ensureQueries, DEFAULT_RANGE } from 'app/core/utils/explore';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { Emitter } from 'app/core/utils/emitter';

import {
  addQueryRow,
  changeDatasource,
  changeQuery,
  changeSize,
  changeTime,
  clickClear,
  clickCloseSplit,
  clickExample,
  clickGraphButton,
  clickLogsButton,
  clickSplit,
  clickTableButton,
  highlightLogsExpression,
  initializeExplore,
  modifyQueries,
  removeQueryRow,
  runQueries,
  scanStart,
  scanStop,
} from './state/actions';
import { ExploreItemState } from './state/reducers';

import Panel from './Panel';
import QueryRows from './QueryRows';
import Graph from './Graph';
import Logs from './Logs';
import Table from './Table';
import ErrorBoundary from './ErrorBoundary';
import { Alert } from './Error';
import TimePicker, { parseTime } from './TimePicker';
import { LogsModel } from 'app/core/logs_model';
import TableModel from 'app/core/table_model';

interface ExploreProps {
  StartPage?: any;
  addQueryRow: typeof addQueryRow;
  changeDatasource: typeof changeDatasource;
  changeQuery: typeof changeQuery;
  changeSize: typeof changeSize;
  changeTime: typeof changeTime;
  clickClear: typeof clickClear;
  clickCloseSplit: typeof clickCloseSplit;
  clickExample: typeof clickExample;
  clickGraphButton: typeof clickGraphButton;
  clickLogsButton: typeof clickLogsButton;
  clickSplit: typeof clickSplit;
  clickTableButton: typeof clickTableButton;
  datasourceError: string;
  datasourceInstance: any;
  datasourceLoading: boolean | null;
  datasourceMissing: boolean;
  exploreDatasources: DataSourceSelectItem[];
  exploreId: ExploreId;
  graphResult?: any[];
  highlightLogsExpression: typeof highlightLogsExpression;
  history: HistoryItem[];
  initialDatasource?: string;
  initialQueries: DataQuery[];
  initializeExplore: typeof initializeExplore;
  logsHighlighterExpressions?: string[];
  logsResult?: LogsModel;
  modifyQueries: typeof modifyQueries;
  queryTransactions: QueryTransaction[];
  removeQueryRow: typeof removeQueryRow;
  range: RawTimeRange;
  runQueries: typeof runQueries;
  scanner?: RangeScanner;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  scanStart: typeof scanStart;
  scanStop: typeof scanStop;
  split: boolean;
  showingGraph: boolean;
  showingLogs: boolean;
  showingStartPage?: boolean;
  showingTable: boolean;
  supportsGraph: boolean | null;
  supportsLogs: boolean | null;
  supportsTable: boolean | null;
  tableResult?: TableModel;
  urlState: ExploreUrlState;
}

/**
 * Explore provides an area for quick query iteration for a given datasource.
 * Once a datasource is selected it populates the query section at the top.
 * When queries are run, their results are being displayed in the main section.
 * The datasource determines what kind of query editor it brings, and what kind
 * of results viewers it supports.
 *
 * QUERY HANDLING
 *
 * TLDR: to not re-render Explore during edits, query editing is not "controlled"
 * in a React sense: values need to be pushed down via `initialQueries`, while
 * edits travel up via `this.modifiedQueries`.
 *
 * By default the query rows start without prior state: `initialQueries` will
 * contain one empty DataQuery. While the user modifies the DataQuery, the
 * modifications are being tracked in `this.modifiedQueries`, which need to be
 * used whenever a query is sent to the datasource to reflect what the user sees
 * on the screen. Query"react-popper": "^0.7.5", rows can be initialized or reset using `initialQueries`,
 * by giving the respec"react-popper": "^0.7.5",tive row a new key. This wipes the old row and its state.
 * This property is als"react-popper": "^0.7.5",o used to govern how many query rows there are (minimum 1).
 *
 * This flow makes sure that a query row can be arbitrarily complex without the
 * fear of being wiped or re-initialized via props. The query row is free to keep
 * its own state while the user edits or builds a query. Valid queries can be sent
 * up to Explore via the `onChangeQuery` prop.
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
export class Explore extends React.PureComponent<ExploreProps> {
  el: any;
  exploreEvents: Emitter;
  /**
   * Timepicker to control scanning
   */
  timepickerRef: React.RefObject<TimePicker>;

  constructor(props) {
    super(props);
    this.exploreEvents = new Emitter();
    this.timepickerRef = React.createRef();
  }

  async componentDidMount() {
    const { exploreId, split, urlState } = this.props;
    if (!split) {
      // Load URL state and parse range
      const { datasource, queries, range = DEFAULT_RANGE } = (urlState || {}) as ExploreUrlState;
      const initialDatasource = datasource || store.get(LAST_USED_DATASOURCE_KEY);
      const initialQueries: DataQuery[] = ensureQueries(queries);
      const initialRange = { from: parseTime(range.from), to: parseTime(range.to) };
      const width = this.el ? this.el.offsetWidth : 0;
      this.props.initializeExplore(
        exploreId,
        initialDatasource,
        initialQueries,
        initialRange,
        width,
        this.exploreEvents
      );
    }
  }

  componentWillUnmount() {
    this.exploreEvents.removeAllListeners();
  }

  getRef = el => {
    this.el = el;
  };

  onAddQueryRow = index => {
    this.props.addQueryRow(this.props.exploreId, index);
  };

  onChangeDatasource = async option => {
    this.props.changeDatasource(this.props.exploreId, option.value);
  };

  onChangeQuery = (query: DataQuery, index: number, override?: boolean) => {
    const { changeQuery, datasourceInstance, exploreId } = this.props;

    changeQuery(exploreId, query, index, override);
    if (query && !override && datasourceInstance.getHighlighterExpression && index === 0) {
      // Live preview of log search matches. Only use on first row for now
      this.updateLogsHighlights(query);
    }
  };

  onChangeTime = (range: TimeRange, changedByScanner?: boolean) => {
    if (this.props.scanning && !changedByScanner) {
      this.onStopScanning();
    }
    this.props.changeTime(this.props.exploreId, range);
  };

  onClickClear = () => {
    this.props.clickClear(this.props.exploreId);
  };

  onClickCloseSplit = () => {
    this.props.clickCloseSplit();
  };

  onClickGraphButton = () => {
    this.props.clickGraphButton(this.props.exploreId);
  };

  onClickLogsButton = () => {
    this.props.clickLogsButton(this.props.exploreId);
  };

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    this.props.clickExample(this.props.exploreId, query);
  };

  onClickSplit = () => {
    this.props.clickSplit();
  };

  onClickTableButton = () => {
    this.props.clickTableButton(this.props.exploreId);
  };

  onClickLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', key, value });
  };

  onModifyQueries = (action, index?: number) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance && datasourceInstance.modifyQuery) {
      const modifier = (queries: DataQuery, action: any) => datasourceInstance.modifyQuery(queries, action);
      this.props.modifyQueries(this.props.exploreId, action, index, modifier);
    }
  };

  onRemoveQueryRow = index => {
    this.props.removeQueryRow(this.props.exploreId, index);
  };

  onResize = (size: { height: number; width: number }) => {
    this.props.changeSize(this.props.exploreId, size);
  };

  onStartScanning = () => {
    // Scanner will trigger a query
    const scanner = this.scanPreviousRange;
    this.props.scanStart(this.props.exploreId, scanner);
  };

  scanPreviousRange = (): RawTimeRange => {
    // Calling move() on the timepicker will trigger this.onChangeTime()
    return this.timepickerRef.current.move(-1, true);
  };

  onStopScanning = () => {
    this.props.scanStop(this.props.exploreId);
  };

  onSubmit = () => {
    this.props.runQueries(this.props.exploreId);
  };

  updateLogsHighlights = _.debounce((value: DataQuery) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance.getHighlighterExpression) {
      const expressions = [datasourceInstance.getHighlighterExpression(value)];
      this.props.highlightLogsExpression(this.props.exploreId, expressions);
    }
  }, 500);

  // saveState = () => {
  //   const { stateKey, onSaveState } = this.props;
  //   onSaveState(stateKey, this.cloneState());
  // };

  render() {
    const {
      StartPage,
      datasourceInstance,
      datasourceError,
      datasourceLoading,
      datasourceMissing,
      exploreDatasources,
      exploreId,
      graphResult,
      history,
      initialQueries,
      logsHighlighterExpressions,
      logsResult,
      queryTransactions,
      range,
      scanning,
      scanRange,
      showingGraph,
      showingLogs,
      showingStartPage,
      showingTable,
      split,
      supportsGraph,
      supportsLogs,
      supportsTable,
      tableResult,
    } = this.props;
    const graphHeight = showingGraph && showingTable ? '200px' : '400px';
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const selectedDatasource = datasourceInstance
      ? exploreDatasources.find(d => d.name === datasourceInstance.name)
      : undefined;
    const graphLoading = queryTransactions.some(qt => qt.resultType === 'Graph' && !qt.done);
    const tableLoading = queryTransactions.some(qt => qt.resultType === 'Table' && !qt.done);
    const logsLoading = queryTransactions.some(qt => qt.resultType === 'Logs' && !qt.done);
    const loading = queryTransactions.some(qt => !qt.done);

    return (
      <div className={exploreClass} ref={this.getRef}>
        <div className="navbar">
          {exploreId === 'left' ? (
            <div>
              <a className="navbar-page-btn">
                <i className="fa fa-rocket" />
                Explore
              </a>
            </div>
          ) : (
            <div className="navbar-buttons explore-first-button">
              <button className="btn navbar-button" onClick={this.onClickCloseSplit}>
                Close Split
              </button>
            </div>
          )}
          {!datasourceMissing ? (
            <div className="navbar-buttons">
              <DataSourcePicker
                onChange={this.onChangeDatasource}
                datasources={exploreDatasources}
                current={selectedDatasource}
              />
            </div>
          ) : null}
          <div className="navbar__spacer" />
          {exploreId === 'left' && !split ? (
            <div className="navbar-buttons">
              <button className="btn navbar-button" onClick={this.onClickSplit}>
                Split
              </button>
            </div>
          ) : null}
          <TimePicker ref={this.timepickerRef} range={range} onChangeTime={this.onChangeTime} />
          <div className="navbar-buttons">
            <button className="btn navbar-button navbar-button--no-icon" onClick={this.onClickClear}>
              Clear All
            </button>
          </div>
          <div className="navbar-buttons relative">
            <button className="btn navbar-button navbar-button--primary" onClick={this.onSubmit}>
              Run Query{' '}
              {loading ? <i className="fa fa-spinner fa-fw fa-spin run-icon" /> : <i className="fa fa-level-down fa-fw run-icon" />}
            </button>
          </div>
        </div>
        {datasourceLoading ? <div className="explore-container">Loading datasource...</div> : null}
        {datasourceMissing ? (
          <div className="explore-container">Please add a datasource that supports Explore (e.g., Prometheus).</div>
        ) : null}

        {datasourceError && (
          <div className="explore-container">
            <Alert message={`Error connecting to datasource: ${datasourceError}`} />
          </div>
        )}

        {datasourceInstance &&
          !datasourceError && (
            <div className="explore-container">
              <QueryRows
                datasource={datasourceInstance}
                history={history}
                initialQueries={initialQueries}
                onAddQueryRow={this.onAddQueryRow}
                onChangeQuery={this.onChangeQuery}
                onClickHintFix={this.onModifyQueries}
                onExecuteQuery={this.onSubmit}
                onRemoveQueryRow={this.onRemoveQueryRow}
                transactions={queryTransactions}
                exploreEvents={this.exploreEvents}
                range={range}
              />
              <AutoSizer onResize={this.onResize} disableHeight>
                {({ width }) => (
                  <main className="m-t-2" style={{ width }}>
                    <ErrorBoundary>
                      {showingStartPage && <StartPage onClickExample={this.onClickExample} />}
                      {!showingStartPage && (
                        <>
                          {supportsGraph && (
                            <Panel
                              label="Graph"
                              isOpen={showingGraph}
                              loading={graphLoading}
                              onToggle={this.onClickGraphButton}
                            >
                              <Graph
                                data={graphResult}
                                height={graphHeight}
                                id={`explore-graph-${exploreId}`}
                                onChangeTime={this.onChangeTime}
                                range={range}
                                split={split}
                              />
                            </Panel>
                          )}
                          {supportsTable && (
                            <Panel
                              label="Table"
                              loading={tableLoading}
                              isOpen={showingTable}
                              onToggle={this.onClickTableButton}
                            >
                              <Table data={tableResult} loading={tableLoading} onClickCell={this.onClickLabel} />
                            </Panel>
                          )}
                          {supportsLogs && (
                            <Panel
                              label="Logs"
                              loading={logsLoading}
                              isOpen={showingLogs}
                              onToggle={this.onClickLogsButton}
                            >
                              <Logs
                                data={logsResult}
                                exploreId={exploreId}
                                key={logsResult.id}
                                highlighterExpressions={logsHighlighterExpressions}
                                loading={logsLoading}
                                onChangeTime={this.onChangeTime}
                                onClickLabel={this.onClickLabel}
                                onStartScanning={this.onStartScanning}
                                onStopScanning={this.onStopScanning}
                                range={range}
                                scanning={scanning}
                                scanRange={scanRange}
                              />
                            </Panel>
                          )}
                        </>
                      )}
                    </ErrorBoundary>
                  </main>
                )}
              </AutoSizer>
            </div>
          )}
      </div>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const { split } = explore;
  const item: ExploreItemState = explore[exploreId];
  const {
    StartPage,
    datasourceError,
    datasourceInstance,
    datasourceLoading,
    datasourceMissing,
    exploreDatasources,
    graphResult,
    initialDatasource,
    initialQueries,
    history,
    logsHighlighterExpressions,
    logsResult,
    queryTransactions,
    range,
    scanning,
    scanRange,
    showingGraph,
    showingLogs,
    showingStartPage,
    showingTable,
    supportsGraph,
    supportsLogs,
    supportsTable,
    tableResult,
  } = item;
  return {
    StartPage,
    datasourceError,
    datasourceInstance,
    datasourceLoading,
    datasourceMissing,
    exploreDatasources,
    graphResult,
    initialDatasource,
    initialQueries,
    history,
    logsHighlighterExpressions,
    logsResult,
    queryTransactions,
    range,
    scanning,
    scanRange,
    showingGraph,
    showingLogs,
    showingStartPage,
    showingTable,
    split,
    supportsGraph,
    supportsLogs,
    supportsTable,
    tableResult,
  };
}

const mapDispatchToProps = {
  addQueryRow,
  changeDatasource,
  changeQuery,
  changeSize,
  changeTime,
  clickClear,
  clickCloseSplit,
  clickExample,
  clickGraphButton,
  clickLogsButton,
  clickSplit,
  clickTableButton,
  highlightLogsExpression,
  initializeExplore,
  modifyQueries,
  removeQueryRow,
  runQueries,
  scanStart,
  scanStop,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Explore));
