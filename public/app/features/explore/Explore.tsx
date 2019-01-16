import React from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import _ from 'lodash';
import { AutoSizer } from 'react-virtualized';
import { RawTimeRange, TimeRange } from '@grafana/ui';

import { DataSourceSelectItem } from 'app/types/datasources';
import { ExploreItemState, ExploreUrlState, RangeScanner, ExploreId } from 'app/types/explore';
import { DataQuery } from 'app/types/series';
import { StoreState } from 'app/types';
import store from 'app/core/store';
import { LAST_USED_DATASOURCE_KEY, ensureQueries, DEFAULT_RANGE } from 'app/core/utils/explore';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { Emitter } from 'app/core/utils/emitter';

import {
  changeDatasource,
  changeSize,
  changeTime,
  clearQueries,
  initializeExplore,
  modifyQueries,
  runQueries,
  scanStart,
  scanStop,
  setQueries,
  splitClose,
  splitOpen,
} from './state/actions';

import { Alert } from './Error';
import ErrorBoundary from './ErrorBoundary';
import GraphContainer from './GraphContainer';
import LogsContainer from './LogsContainer';
import QueryRows from './QueryRows';
import TableContainer from './TableContainer';
import TimePicker, { parseTime } from './TimePicker';

interface ExploreProps {
  StartPage?: any;
  changeDatasource: typeof changeDatasource;
  changeSize: typeof changeSize;
  changeTime: typeof changeTime;
  clearQueries: typeof clearQueries;
  datasourceError: string;
  datasourceInstance: any;
  datasourceLoading: boolean | null;
  datasourceMissing: boolean;
  exploreDatasources: DataSourceSelectItem[];
  exploreId: ExploreId;
  initialDatasource?: string;
  initialQueries: DataQuery[];
  initializeExplore: typeof initializeExplore;
  initialized: boolean;
  loading: boolean;
  modifyQueries: typeof modifyQueries;
  range: RawTimeRange;
  runQueries: typeof runQueries;
  scanner?: RangeScanner;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  scanStart: typeof scanStart;
  scanStop: typeof scanStop;
  setQueries: typeof setQueries;
  split: boolean;
  splitClose: typeof splitClose;
  splitOpen: typeof splitOpen;
  showingStartPage?: boolean;
  supportsGraph: boolean | null;
  supportsLogs: boolean | null;
  supportsTable: boolean | null;
  urlState: ExploreUrlState;
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
    const { exploreId, initialized, urlState } = this.props;
    // Don't initialize on split, but need to initialize urlparameters when present
    if (!initialized) {
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

  onChangeDatasource = async option => {
    this.props.changeDatasource(this.props.exploreId, option.value);
  };

  onChangeTime = (range: TimeRange, changedByScanner?: boolean) => {
    if (this.props.scanning && !changedByScanner) {
      this.onStopScanning();
    }
    this.props.changeTime(this.props.exploreId, range);
  };

  onClickClear = () => {
    this.props.clearQueries(this.props.exploreId);
  };

  onClickCloseSplit = () => {
    this.props.splitClose();
  };

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    this.props.setQueries(this.props.exploreId, [query]);
  };

  onClickSplit = () => {
    this.props.splitOpen();
  };

  onClickLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', key, value });
  };

  onModifyQueries = (action, index?: number) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance && datasourceInstance.modifyQuery) {
      const modifier = (queries: DataQuery, modification: any) => datasourceInstance.modifyQuery(queries, modification);
      this.props.modifyQueries(this.props.exploreId, action, index, modifier);
    }
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

  render() {
    const {
      StartPage,
      datasourceInstance,
      datasourceError,
      datasourceLoading,
      datasourceMissing,
      exploreDatasources,
      exploreId,
      loading,
      initialQueries,
      range,
      showingStartPage,
      split,
      supportsGraph,
      supportsLogs,
      supportsTable,
    } = this.props;
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const selectedDatasource = datasourceInstance
      ? exploreDatasources.find(d => d.name === datasourceInstance.name)
      : undefined;

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
              <QueryRows exploreEvents={this.exploreEvents} exploreId={exploreId} initialQueries={initialQueries} />
              <AutoSizer onResize={this.onResize} disableHeight>
                {({ width }) => (
                  <main className="m-t-2" style={{ width }}>
                    <ErrorBoundary>
                      {showingStartPage && <StartPage onClickExample={this.onClickExample} />}
                      {!showingStartPage && (
                        <>
                          {supportsGraph && <GraphContainer exploreId={exploreId} />}
                          {supportsTable && <TableContainer exploreId={exploreId} onClickCell={this.onClickLabel} />}
                          {supportsLogs && (
                            <LogsContainer
                              exploreId={exploreId}
                              onChangeTime={this.onChangeTime}
                              onClickLabel={this.onClickLabel}
                              onStartScanning={this.onStartScanning}
                              onStopScanning={this.onStopScanning}
                            />
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
    initialDatasource,
    initialQueries,
    initialized,
    queryTransactions,
    range,
    showingStartPage,
    supportsGraph,
    supportsLogs,
    supportsTable,
  } = item;
  const loading = queryTransactions.some(qt => !qt.done);
  return {
    StartPage,
    datasourceError,
    datasourceInstance,
    datasourceLoading,
    datasourceMissing,
    exploreDatasources,
    initialDatasource,
    initialQueries,
    initialized,
    loading,
    queryTransactions,
    range,
    showingStartPage,
    split,
    supportsGraph,
    supportsLogs,
    supportsTable,
  };
}

const mapDispatchToProps = {
  changeDatasource,
  changeSize,
  changeTime,
  clearQueries,
  initializeExplore,
  modifyQueries,
  runQueries,
  scanStart,
  scanStop,
  setQueries,
  splitClose,
  splitOpen,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Explore));
