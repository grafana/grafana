import React from 'react';
import { hot } from 'react-hot-loader';
import Select from 'react-select';

import kbn from 'app/core/utils/kbn';
import colors from 'app/core/utils/colors';
import store from 'app/core/store';
import TimeSeries from 'app/core/time_series2';
import { decodePathComponent } from 'app/core/utils/location_util';
import { parse as parseDate } from 'app/core/utils/datemath';

import ElapsedTime from './ElapsedTime';
import QueryRows from './QueryRows';
import Graph from './Graph';
import Logs from './Logs';
import Table from './Table';
import TimePicker, { DEFAULT_RANGE } from './TimePicker';
import { ensureQueries, generateQueryKey, hasQuery } from './utils/query';

const MAX_HISTORY_ITEMS = 100;

function makeHints(hints) {
  const hintsByIndex = [];
  hints.forEach(hint => {
    if (hint) {
      hintsByIndex[hint.index] = hint;
    }
  });
  return hintsByIndex;
}

function makeTimeSeriesList(dataList, options) {
  return dataList.map((seriesData, index) => {
    const datapoints = seriesData.datapoints || [];
    const alias = seriesData.target;
    const colorIndex = index % colors.length;
    const color = colors[colorIndex];

    const series = new TimeSeries({
      datapoints,
      alias,
      color,
      unit: seriesData.unit,
    });

    return series;
  });
}

function parseUrlState(initial: string | undefined) {
  if (initial) {
    try {
      const parsed = JSON.parse(decodePathComponent(initial));
      return {
        datasource: parsed.datasource,
        queries: parsed.queries.map(q => q.query),
        range: parsed.range,
      };
    } catch (e) {
      console.error(e);
    }
  }
  return { datasource: null, queries: [], range: DEFAULT_RANGE };
}

interface ExploreState {
  datasource: any;
  datasourceError: any;
  datasourceLoading: boolean | null;
  datasourceMissing: boolean;
  graphResult: any;
  history: any[];
  initialDatasource?: string;
  latency: number;
  loading: any;
  logsResult: any;
  queries: any[];
  queryErrors: any[];
  queryHints: any[];
  range: any;
  requestOptions: any;
  showingGraph: boolean;
  showingLogs: boolean;
  showingTable: boolean;
  supportsGraph: boolean | null;
  supportsLogs: boolean | null;
  supportsTable: boolean | null;
  tableResult: any;
}

export class Explore extends React.Component<any, ExploreState> {
  el: any;

  constructor(props) {
    super(props);
    const initialState: ExploreState = props.initialState;
    const { datasource, queries, range } = parseUrlState(props.routeParams.state);
    this.state = {
      datasource: null,
      datasourceError: null,
      datasourceLoading: null,
      datasourceMissing: false,
      graphResult: null,
      initialDatasource: datasource,
      history: [],
      latency: 0,
      loading: false,
      logsResult: null,
      queries: ensureQueries(queries),
      queryErrors: [],
      queryHints: [],
      range: range || { ...DEFAULT_RANGE },
      requestOptions: null,
      showingGraph: true,
      showingLogs: true,
      showingTable: true,
      supportsGraph: null,
      supportsLogs: null,
      supportsTable: null,
      tableResult: null,
      ...initialState,
    };
  }

  async componentDidMount() {
    const { datasourceSrv } = this.props;
    const { initialDatasource } = this.state;
    if (!datasourceSrv) {
      throw new Error('No datasource service passed as props.');
    }
    const datasources = datasourceSrv.getExploreSources();
    if (datasources.length > 0) {
      this.setState({ datasourceLoading: true });
      // Priority: datasource in url, default datasource, first explore datasource
      let datasource;
      if (initialDatasource) {
        datasource = await datasourceSrv.get(initialDatasource);
      } else {
        datasource = await datasourceSrv.get();
      }
      if (!datasource.meta.explore) {
        datasource = await datasourceSrv.get(datasources[0].name);
      }
      this.setDatasource(datasource);
    } else {
      this.setState({ datasourceMissing: true });
    }
  }

  componentDidCatch(error) {
    this.setState({ datasourceError: error });
    console.error(error);
  }

  async setDatasource(datasource) {
    const supportsGraph = datasource.meta.metrics;
    const supportsLogs = datasource.meta.logs;
    const supportsTable = datasource.meta.metrics;
    const datasourceId = datasource.meta.id;
    let datasourceError = null;

    try {
      const testResult = await datasource.testDatasource();
      datasourceError = testResult.status === 'success' ? null : testResult.message;
    } catch (error) {
      datasourceError = (error && error.statusText) || error;
    }

    const historyKey = `grafana.explore.history.${datasourceId}`;
    const history = store.getObject(historyKey, []);

    if (datasource.init) {
      datasource.init();
    }

    this.setState(
      {
        datasource,
        datasourceError,
        history,
        supportsGraph,
        supportsLogs,
        supportsTable,
        datasourceLoading: false,
      },
      () => datasourceError === null && this.onSubmit()
    );
  }

  getRef = el => {
    this.el = el;
  };

  onAddQueryRow = index => {
    const { queries } = this.state;
    const nextQueries = [
      ...queries.slice(0, index + 1),
      { query: '', key: generateQueryKey() },
      ...queries.slice(index + 1),
    ];
    this.setState({ queries: nextQueries });
  };

  onChangeDatasource = async option => {
    this.setState({
      datasource: null,
      datasourceError: null,
      datasourceLoading: true,
      graphResult: null,
      latency: 0,
      logsResult: null,
      queryErrors: [],
      queryHints: [],
      tableResult: null,
    });
    const datasource = await this.props.datasourceSrv.get(option.value);
    this.setDatasource(datasource);
  };

  onChangeQuery = (value: string, index: number, override?: boolean) => {
    const { queries } = this.state;
    let { queryErrors, queryHints } = this.state;
    const prevQuery = queries[index];
    const edited = override ? false : prevQuery.query !== value;
    const nextQuery = {
      ...queries[index],
      edited,
      query: value,
    };
    const nextQueries = [...queries];
    nextQueries[index] = nextQuery;
    if (override) {
      queryErrors = [];
      queryHints = [];
    }
    this.setState(
      {
        queryErrors,
        queryHints,
        queries: nextQueries,
      },
      override ? () => this.onSubmit() : undefined
    );
  };

  onChangeTime = nextRange => {
    const range = {
      from: nextRange.from,
      to: nextRange.to,
    };
    this.setState({ range }, () => this.onSubmit());
  };

  onClickClear = () => {
    this.setState({
      graphResult: null,
      logsResult: null,
      latency: 0,
      queries: ensureQueries(),
      queryErrors: [],
      queryHints: [],
      tableResult: null,
    });
  };

  onClickCloseSplit = () => {
    const { onChangeSplit } = this.props;
    if (onChangeSplit) {
      onChangeSplit(false);
    }
  };

  onClickGraphButton = () => {
    this.setState(state => ({ showingGraph: !state.showingGraph }));
  };

  onClickLogsButton = () => {
    this.setState(state => ({ showingLogs: !state.showingLogs }));
  };

  onClickSplit = () => {
    const { onChangeSplit } = this.props;
    const state = { ...this.state };
    state.queries = state.queries.map(({ edited, ...rest }) => rest);
    if (onChangeSplit) {
      onChangeSplit(true, state);
    }
  };

  onClickTableButton = () => {
    this.setState(state => ({ showingTable: !state.showingTable }));
  };

  onClickTableCell = (columnKey: string, rowValue: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', key: columnKey, value: rowValue });
  };

  onModifyQueries = (action: object, index?: number) => {
    const { datasource, queries } = this.state;
    if (datasource && datasource.modifyQuery) {
      let nextQueries;
      if (index === undefined) {
        // Modify all queries
        nextQueries = queries.map(q => ({
          ...q,
          edited: false,
          query: datasource.modifyQuery(q.query, action),
        }));
      } else {
        // Modify query only at index
        nextQueries = [
          ...queries.slice(0, index),
          {
            ...queries[index],
            edited: false,
            query: datasource.modifyQuery(queries[index].query, action),
          },
          ...queries.slice(index + 1),
        ];
      }
      this.setState({ queries: nextQueries }, () => this.onSubmit());
    }
  };

  onRemoveQueryRow = index => {
    const { queries } = this.state;
    if (queries.length <= 1) {
      return;
    }
    const nextQueries = [...queries.slice(0, index), ...queries.slice(index + 1)];
    this.setState({ queries: nextQueries }, () => this.onSubmit());
  };

  onSubmit = () => {
    const { showingLogs, showingGraph, showingTable, supportsGraph, supportsLogs, supportsTable } = this.state;
    if (showingTable && supportsTable) {
      this.runTableQuery();
    }
    if (showingGraph && supportsGraph) {
      this.runGraphQuery();
    }
    if (showingLogs && supportsLogs) {
      this.runLogsQuery();
    }
  };

  onQuerySuccess(datasourceId: string, queries: any[]): void {
    // save queries to history
    let { history } = this.state;
    const { datasource } = this.state;

    if (datasource.meta.id !== datasourceId) {
      // Navigated away, queries did not matter
      return;
    }

    const ts = Date.now();
    queries.forEach(q => {
      const { query } = q;
      history = [{ query, ts }, ...history];
    });

    if (history.length > MAX_HISTORY_ITEMS) {
      history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    // Combine all queries of a datasource type into one history
    const historyKey = `grafana.explore.history.${datasourceId}`;
    store.setObject(historyKey, history);
    this.setState({ history });
  }

  buildQueryOptions(targetOptions: { format: string; hinting?: boolean; instant?: boolean }) {
    const { datasource, queries, range } = this.state;
    const resolution = this.el.offsetWidth;
    const absoluteRange = {
      from: parseDate(range.from, false),
      to: parseDate(range.to, true),
    };
    const { interval } = kbn.calculateInterval(absoluteRange, resolution, datasource.interval);
    const targets = queries.map(q => ({
      ...targetOptions,
      expr: q.query,
    }));
    return {
      interval,
      range,
      targets,
    };
  }

  async runGraphQuery() {
    const { datasource, queries } = this.state;
    if (!hasQuery(queries)) {
      return;
    }
    this.setState({ latency: 0, loading: true, graphResult: null, queryErrors: [], queryHints: [] });
    const now = Date.now();
    const options = this.buildQueryOptions({ format: 'time_series', instant: false, hinting: true });
    try {
      const res = await datasource.query(options);
      const result = makeTimeSeriesList(res.data, options);
      const queryHints = res.hints ? makeHints(res.hints) : [];
      const latency = Date.now() - now;
      this.setState({ latency, loading: false, graphResult: result, queryHints, requestOptions: options });
      this.onQuerySuccess(datasource.meta.id, queries);
    } catch (response) {
      console.error(response);
      const queryError = response.data ? response.data.error : response;
      this.setState({ loading: false, queryErrors: [queryError] });
    }
  }

  async runTableQuery() {
    const { datasource, queries } = this.state;
    if (!hasQuery(queries)) {
      return;
    }
    this.setState({ latency: 0, loading: true, queryErrors: [], queryHints: [], tableResult: null });
    const now = Date.now();
    const options = this.buildQueryOptions({
      format: 'table',
      instant: true,
    });
    try {
      const res = await datasource.query(options);
      const tableModel = res.data[0];
      const latency = Date.now() - now;
      this.setState({ latency, loading: false, tableResult: tableModel, requestOptions: options });
      this.onQuerySuccess(datasource.meta.id, queries);
    } catch (response) {
      console.error(response);
      const queryError = response.data ? response.data.error : response;
      this.setState({ loading: false, queryErrors: [queryError] });
    }
  }

  async runLogsQuery() {
    const { datasource, queries } = this.state;
    if (!hasQuery(queries)) {
      return;
    }
    this.setState({ latency: 0, loading: true, queryErrors: [], queryHints: [], logsResult: null });
    const now = Date.now();
    const options = this.buildQueryOptions({
      format: 'logs',
    });

    try {
      const res = await datasource.query(options);
      const logsData = res.data;
      const latency = Date.now() - now;
      this.setState({ latency, loading: false, logsResult: logsData, requestOptions: options });
      this.onQuerySuccess(datasource.meta.id, queries);
    } catch (response) {
      console.error(response);
      const queryError = response.data ? response.data.error : response;
      this.setState({ loading: false, queryErrors: [queryError] });
    }
  }

  request = url => {
    const { datasource } = this.state;
    return datasource.metadataRequest(url);
  };

  render() {
    const { datasourceSrv, position, split } = this.props;
    const {
      datasource,
      datasourceError,
      datasourceLoading,
      datasourceMissing,
      graphResult,
      history,
      latency,
      loading,
      logsResult,
      queries,
      queryErrors,
      queryHints,
      range,
      requestOptions,
      showingGraph,
      showingLogs,
      showingTable,
      supportsGraph,
      supportsLogs,
      supportsTable,
      tableResult,
    } = this.state;
    const showingBoth = showingGraph && showingTable;
    const graphHeight = showingBoth ? '200px' : '400px';
    const graphButtonActive = showingBoth || showingGraph ? 'active' : '';
    const logsButtonActive = showingLogs ? 'active' : '';
    const tableButtonActive = showingBoth || showingTable ? 'active' : '';
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const datasources = datasourceSrv.getExploreSources().map(ds => ({
      value: ds.name,
      label: ds.name,
    }));
    const selectedDatasource = datasource ? datasource.name : undefined;

    return (
      <div className={exploreClass} ref={this.getRef}>
        <div className="navbar">
          {position === 'left' ? (
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
              <Select
                className="datasource-picker"
                clearable={false}
                onChange={this.onChangeDatasource}
                options={datasources}
                placeholder="Loading datasources..."
                value={selectedDatasource}
              />
            </div>
          ) : null}
          <div className="navbar__spacer" />
          {position === 'left' && !split ? (
            <div className="navbar-buttons">
              <button className="btn navbar-button" onClick={this.onClickSplit}>
                Split
              </button>
            </div>
          ) : null}
          <TimePicker range={range} onChangeTime={this.onChangeTime} />
          <div className="navbar-buttons">
            <button className="btn navbar-button navbar-button--no-icon" onClick={this.onClickClear}>
              Clear All
            </button>
          </div>
          <div className="navbar-buttons relative">
            <button className="btn navbar-button--primary" onClick={this.onSubmit}>
              Run Query <i className="fa fa-level-down run-icon" />
            </button>
            {loading || latency ? <ElapsedTime time={latency} className="text-info" /> : null}
          </div>
        </div>

        {datasourceLoading ? <div className="explore-container">Loading datasource...</div> : null}

        {datasourceMissing ? (
          <div className="explore-container">Please add a datasource that supports Explore (e.g., Prometheus).</div>
        ) : null}

        {datasourceError ? (
          <div className="explore-container">Error connecting to datasource. [{datasourceError}]</div>
        ) : null}

        {datasource && !datasourceError ? (
          <div className="explore-container">
            <QueryRows
              history={history}
              queries={queries}
              queryErrors={queryErrors}
              queryHints={queryHints}
              request={this.request}
              onAddQueryRow={this.onAddQueryRow}
              onChangeQuery={this.onChangeQuery}
              onClickHintFix={this.onModifyQueries}
              onExecuteQuery={this.onSubmit}
              onRemoveQueryRow={this.onRemoveQueryRow}
            />
            <div className="result-options">
              {supportsGraph ? (
                <button className={`btn navbar-button ${graphButtonActive}`} onClick={this.onClickGraphButton}>
                  Graph
                </button>
              ) : null}
              {supportsTable ? (
                <button className={`btn navbar-button ${tableButtonActive}`} onClick={this.onClickTableButton}>
                  Table
                </button>
              ) : null}
              {supportsLogs ? (
                <button className={`btn navbar-button ${logsButtonActive}`} onClick={this.onClickLogsButton}>
                  Logs
                </button>
              ) : null}
            </div>

            <main className="m-t-2">
              {supportsGraph && showingGraph ? (
                <Graph
                  data={graphResult}
                  height={graphHeight}
                  loading={loading}
                  id={`explore-graph-${position}`}
                  options={requestOptions}
                  split={split}
                />
              ) : null}
              {supportsTable && showingTable ? (
                <Table className="m-t-3" data={tableResult} loading={loading} onClickCell={this.onClickTableCell} />
              ) : null}
              {supportsLogs && showingLogs ? <Logs data={logsResult} loading={loading} /> : null}
            </main>
          </div>
        ) : null}
      </div>
    );
  }
}

export default hot(module)(Explore);
