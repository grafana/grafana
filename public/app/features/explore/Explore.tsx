import React from 'react';
import { hot } from 'react-hot-loader';
import Select from 'react-select';

import { ExploreState, ExploreUrlState, Query } from 'app/types/explore';
import kbn from 'app/core/utils/kbn';
import colors from 'app/core/utils/colors';
import store from 'app/core/store';
import TimeSeries from 'app/core/time_series2';
import { parse as parseDate } from 'app/core/utils/datemath';
import { DEFAULT_RANGE } from 'app/core/utils/explore';
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import PickerOption from 'app/core/components/Picker/PickerOption';
import IndicatorsContainer from 'app/core/components/Picker/IndicatorsContainer';
import NoOptionsMessage from 'app/core/components/Picker/NoOptionsMessage';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';

import ElapsedTime from './ElapsedTime';
import QueryRows from './QueryRows';
import Graph from './Graph';
import Logs from './Logs';
import Table from './Table';
import TimePicker from './TimePicker';
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

interface ExploreProps {
  datasourceSrv: any;
  onChangeSplit: (split: boolean, state?: ExploreState) => void;
  onSaveState: (key: string, state: ExploreState) => void;
  position: string;
  split: boolean;
  splitState?: ExploreState;
  stateKey: string;
  urlState: ExploreUrlState;
}

export class Explore extends React.PureComponent<ExploreProps, ExploreState> {
  el: any;
  /**
   * Current query expressions of the rows including their modifications, used for running queries.
   * Not kept in component state to prevent edit-render roundtrips.
   */
  queryExpressions: string[];

  constructor(props) {
    super(props);
    const splitState: ExploreState = props.splitState;
    let initialQueries: Query[];
    if (splitState) {
      // Split state overrides everything
      this.state = splitState;
      initialQueries = splitState.queries;
    } else {
      const { datasource, queries, range } = props.urlState as ExploreUrlState;
      initialQueries = ensureQueries(queries);
      this.state = {
        datasource: null,
        datasourceError: null,
        datasourceLoading: null,
        datasourceMissing: false,
        datasourceName: datasource,
        exploreDatasources: [],
        graphResult: null,
        history: [],
        latency: 0,
        loading: false,
        logsResult: null,
        queries: initialQueries,
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
      };
    }
    this.queryExpressions = initialQueries.map(q => q.query);
  }

  async componentDidMount() {
    const { datasourceSrv } = this.props;
    const { datasourceName } = this.state;
    if (!datasourceSrv) {
      throw new Error('No datasource service passed as props.');
    }
    const datasources = datasourceSrv.getExploreSources();
    const exploreDatasources = datasources.map(ds => ({
      value: ds.name,
      label: ds.name,
    }));

    if (datasources.length > 0) {
      this.setState({ datasourceLoading: true, exploreDatasources });
      // Priority: datasource in url, default datasource, first explore datasource
      let datasource;
      if (datasourceName) {
        datasource = await datasourceSrv.get(datasourceName);
      } else {
        datasource = await datasourceSrv.get();
      }
      if (!datasource.meta.explore) {
        datasource = await datasourceSrv.get(datasources[0].name);
      }
      await this.setDatasource(datasource);
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

    // Keep queries but reset edit state
    const nextQueries = this.state.queries.map((q, i) => ({
      ...q,
      key: generateQueryKey(i),
      query: this.queryExpressions[i],
    }));

    this.setState(
      {
        datasource,
        datasourceError,
        history,
        supportsGraph,
        supportsLogs,
        supportsTable,
        datasourceLoading: false,
        datasourceName: datasource.name,
        queries: nextQueries,
      },
      () => {
        if (datasourceError === null) {
          this.onSubmit();
        }
      }
    );
  }

  getRef = el => {
    this.el = el;
  };

  onAddQueryRow = index => {
    const { queries } = this.state;
    this.queryExpressions[index + 1] = '';
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
    const datasourceName = option.value;
    const datasource = await this.props.datasourceSrv.get(datasourceName);
    this.setDatasource(datasource);
  };

  onChangeQuery = (value: string, index: number, override?: boolean) => {
    // Keep current value in local cache
    this.queryExpressions[index] = value;

    // Replace query row on override
    if (override) {
      const { queries } = this.state;
      const nextQuery: Query = {
        key: generateQueryKey(index),
        query: value,
      };
      const nextQueries = [...queries];
      nextQueries[index] = nextQuery;

      this.setState(
        {
          queryErrors: [],
          queryHints: [],
          queries: nextQueries,
        },
        this.onSubmit
      );
    }
  };

  onChangeTime = nextRange => {
    const range = {
      from: nextRange.from,
      to: nextRange.to,
    };
    this.setState({ range }, () => this.onSubmit());
  };

  onClickClear = () => {
    this.queryExpressions = [''];
    this.setState(
      {
        graphResult: null,
        logsResult: null,
        latency: 0,
        queries: ensureQueries(),
        queryErrors: [],
        queryHints: [],
        tableResult: null,
      },
      this.saveState
    );
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
    if (onChangeSplit) {
      const state = this.cloneState();
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
        nextQueries = queries.map((q, i) => ({
          key: generateQueryKey(i),
          query: datasource.modifyQuery(this.queryExpressions[i], action),
        }));
      } else {
        // Modify query only at index
        nextQueries = [
          ...queries.slice(0, index),
          {
            key: generateQueryKey(index),
            query: datasource.modifyQuery(this.queryExpressions[index], action),
          },
          ...queries.slice(index + 1),
        ];
      }
      this.queryExpressions = nextQueries.map(q => q.query);
      this.setState({ queries: nextQueries }, () => this.onSubmit());
    }
  };

  onRemoveQueryRow = index => {
    const { queries } = this.state;
    if (queries.length <= 1) {
      return;
    }
    const nextQueries = [...queries.slice(0, index), ...queries.slice(index + 1)];
    this.queryExpressions = nextQueries.map(q => q.query);
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
    this.saveState();
  };

  onQuerySuccess(datasourceId: string, queries: string[]): void {
    // save queries to history
    let { history } = this.state;
    const { datasource } = this.state;

    if (datasource.meta.id !== datasourceId) {
      // Navigated away, queries did not matter
      return;
    }

    const ts = Date.now();
    queries.forEach(query => {
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
    const { datasource, range } = this.state;
    const resolution = this.el.offsetWidth;
    const absoluteRange = {
      from: parseDate(range.from, false),
      to: parseDate(range.to, true),
    };
    const { interval } = kbn.calculateInterval(absoluteRange, resolution, datasource.interval);
    const targets = this.queryExpressions.map((q, i) => ({
      ...targetOptions,
      // Target identifier is needed for table transformations
      refId: i + 1,
      expr: q,
    }));
    return {
      interval,
      range,
      targets,
    };
  }

  async runGraphQuery() {
    const { datasource } = this.state;
    const queries = [...this.queryExpressions];
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
    const queries = [...this.queryExpressions];
    const { datasource } = this.state;
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
      const tableModel = mergeTablesIntoModel(new TableModel(), ...res.data);
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
    const queries = [...this.queryExpressions];
    const { datasource } = this.state;
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

  cloneState(): ExploreState {
    // Copy state, but copy queries including modifications
    return {
      ...this.state,
      queries: ensureQueries(this.queryExpressions.map(query => ({ query }))),
    };
  }

  saveState = () => {
    const { stateKey, onSaveState } = this.props;
    onSaveState(stateKey, this.cloneState());
  };

  render() {
    const { position, split } = this.props;
    const {
      datasource,
      datasourceError,
      datasourceLoading,
      datasourceMissing,
      exploreDatasources,
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
    const selectedDatasource = datasource ? exploreDatasources.find(d => d.label === datasource.name) : undefined;

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
                classNamePrefix={`gf-form-select-box`}
                isMulti={false}
                isLoading={datasourceLoading}
                isClearable={false}
                className="gf-form-input gf-form-input--form-dropdown datasource-picker"
                onChange={this.onChangeDatasource}
                options={exploreDatasources}
                styles={ResetStyles}
                placeholder="Select datasource"
                loadingMessage={() => 'Loading datasources...'}
                noOptionsMessage={() => 'No datasources found'}
                value={selectedDatasource}
                components={{
                  Option: PickerOption,
                  IndicatorsContainer,
                  NoOptionsMessage,
                }}
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
              supportsLogs={supportsLogs}
            />
            <div className="result-options">
              {supportsGraph ? (
                <button className={`btn toggle-btn ${graphButtonActive}`} onClick={this.onClickGraphButton}>
                  Graph
                </button>
              ) : null}
              {supportsTable ? (
                <button className={`btn toggle-btn ${tableButtonActive}`} onClick={this.onClickTableButton}>
                  Table
                </button>
              ) : null}
              {supportsLogs ? (
                <button className={`btn toggle-btn ${logsButtonActive}`} onClick={this.onClickLogsButton}>
                  Logs
                </button>
              ) : null}
            </div>

            <main className="m-t-2">
              {supportsGraph &&
                showingGraph &&
                graphResult && (
                  <Graph
                    data={graphResult}
                    height={graphHeight}
                    loading={loading}
                    id={`explore-graph-${position}`}
                    options={requestOptions}
                    split={split}
                  />
                )}
              {supportsTable && showingTable ? (
                <div className="panel-container">
                  <Table data={tableResult} loading={loading} onClickCell={this.onClickTableCell} />
                </div>
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
