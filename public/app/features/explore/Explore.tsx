import React from 'react';
import { hot } from 'react-hot-loader';
import Select from 'react-select';
import _ from 'lodash';

import {
  ExploreState,
  ExploreUrlState,
  HistoryItem,
  Query,
  QueryTransaction,
  Range,
  ResultType,
} from 'app/types/explore';
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

import QueryRows from './QueryRows';
import Graph from './Graph';
import Logs from './Logs';
import Table from './Table';
import TimePicker from './TimePicker';
import { ensureQueries, generateQueryKey, hasQuery } from './utils/query';

const MAX_HISTORY_ITEMS = 100;

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

/**
 * Update the query history. Side-effect: store history in local storage
 */
function updateHistory(history: HistoryItem[], datasourceId: string, queries: string[]): HistoryItem[] {
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
  return history;
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
      const initialRange = range || { ...DEFAULT_RANGE };
      this.state = {
        datasource: null,
        datasourceError: null,
        datasourceLoading: null,
        datasourceMissing: false,
        datasourceName: datasource,
        exploreDatasources: [],
        graphRange: initialRange,
        history: [],
        queries: initialQueries,
        queryTransactions: [],
        range: initialRange,
        showingGraph: true,
        showingLogs: true,
        showingTable: true,
        supportsGraph: null,
        supportsLogs: null,
        supportsTable: null,
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
    // Local cache
    this.queryExpressions[index + 1] = '';

    this.setState(state => {
      const { queries, queryTransactions } = state;

      // Add row by generating new react key
      const nextQueries = [
        ...queries.slice(0, index + 1),
        { query: '', key: generateQueryKey() },
        ...queries.slice(index + 1),
      ];

      // Ongoing transactions need to update their row indices
      const nextQueryTransactions = queryTransactions.map(qt => {
        if (qt.rowIndex > index) {
          return {
            ...qt,
            rowIndex: qt.rowIndex + 1,
          };
        }
        return qt;
      });

      return { queries: nextQueries, queryTransactions: nextQueryTransactions };
    });
  };

  onChangeDatasource = async option => {
    this.setState({
      datasource: null,
      datasourceError: null,
      datasourceLoading: true,
      queryTransactions: [],
    });
    const datasourceName = option.value;
    const datasource = await this.props.datasourceSrv.get(datasourceName);
    this.setDatasource(datasource);
  };

  onChangeQuery = (value: string, index: number, override?: boolean) => {
    // Keep current value in local cache
    this.queryExpressions[index] = value;

    if (override) {
      this.setState(state => {
        // Replace query row
        const { queries, queryTransactions } = state;
        const nextQuery: Query = {
          key: generateQueryKey(index),
          query: value,
        };
        const nextQueries = [...queries];
        nextQueries[index] = nextQuery;

        // Discard ongoing transaction related to row query
        const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);

        return {
          queries: nextQueries,
          queryTransactions: nextQueryTransactions,
        };
      }, this.onSubmit);
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
        queries: ensureQueries(),
        queryTransactions: [],
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
    this.setState(
      state => {
        const showingGraph = !state.showingGraph;
        let nextQueryTransactions = state.queryTransactions;
        if (!showingGraph) {
          // Discard transactions related to Graph query
          nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Graph');
        }
        return { queryTransactions: nextQueryTransactions, showingGraph };
      },
      () => {
        if (this.state.showingGraph) {
          this.onSubmit();
        }
      }
    );
  };

  onClickLogsButton = () => {
    this.setState(
      state => {
        const showingLogs = !state.showingLogs;
        let nextQueryTransactions = state.queryTransactions;
        if (!showingLogs) {
          // Discard transactions related to Logs query
          nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Logs');
        }
        return { queryTransactions: nextQueryTransactions, showingLogs };
      },
      () => {
        if (this.state.showingLogs) {
          this.onSubmit();
        }
      }
    );
  };

  onClickSplit = () => {
    const { onChangeSplit } = this.props;
    if (onChangeSplit) {
      const state = this.cloneState();
      onChangeSplit(true, state);
    }
  };

  onClickTableButton = () => {
    this.setState(
      state => {
        const showingTable = !state.showingTable;
        let nextQueryTransactions = state.queryTransactions;
        if (!showingTable) {
          // Discard transactions related to Table query
          nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Table');
        }
        return { queryTransactions: nextQueryTransactions, showingTable };
      },
      () => {
        if (this.state.showingTable) {
          this.onSubmit();
        }
      }
    );
  };

  onClickTableCell = (columnKey: string, rowValue: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', key: columnKey, value: rowValue });
  };

  onModifyQueries = (action: object, index?: number) => {
    const { datasource } = this.state;
    if (datasource && datasource.modifyQuery) {
      this.setState(
        state => {
          const { queries, queryTransactions } = state;
          let nextQueries;
          let nextQueryTransactions;
          if (index === undefined) {
            // Modify all queries
            nextQueries = queries.map((q, i) => ({
              key: generateQueryKey(i),
              query: datasource.modifyQuery(this.queryExpressions[i], action),
            }));
            // Discard all ongoing transactions
            nextQueryTransactions = [];
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
            // Discard transactions related to row query
            nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);
          }
          this.queryExpressions = nextQueries.map(q => q.query);
          return {
            queries: nextQueries,
            queryTransactions: nextQueryTransactions,
          };
        },
        () => this.onSubmit()
      );
    }
  };

  onRemoveQueryRow = index => {
    // Remove from local cache
    this.queryExpressions = [...this.queryExpressions.slice(0, index), ...this.queryExpressions.slice(index + 1)];

    this.setState(
      state => {
        const { queries, queryTransactions } = state;
        if (queries.length <= 1) {
          return null;
        }
        // Remove row from react state
        const nextQueries = [...queries.slice(0, index), ...queries.slice(index + 1)];

        // Discard transactions related to row query
        const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);

        return {
          queries: nextQueries,
          queryTransactions: nextQueryTransactions,
        };
      },
      () => this.onSubmit()
    );
  };

  onSubmit = () => {
    const { showingLogs, showingGraph, showingTable, supportsGraph, supportsLogs, supportsTable } = this.state;
    if (showingTable && supportsTable) {
      this.runTableQuery();
    }
    if (showingGraph && supportsGraph) {
      this.runGraphQueries();
    }
    if (showingLogs && supportsLogs) {
      this.runLogsQuery();
    }
    this.saveState();
  };

  buildQueryOptions(
    query: string,
    rowIndex: number,
    targetOptions: { format: string; hinting?: boolean; instant?: boolean }
  ) {
    const { datasource, range } = this.state;
    const resolution = this.el.offsetWidth;
    const absoluteRange = {
      from: parseDate(range.from, false),
      to: parseDate(range.to, true),
    };
    const { interval } = kbn.calculateInterval(absoluteRange, resolution, datasource.interval);
    const targets = [
      {
        ...targetOptions,
        // Target identifier is needed for table transformations
        refId: rowIndex + 1,
        expr: query,
      },
    ];

    // Clone range for query request
    const queryRange: Range = { ...range };

    return {
      interval,
      targets,
      range: queryRange,
    };
  }

  startQueryTransaction(query: string, rowIndex: number, resultType: ResultType, options: any): QueryTransaction {
    const queryOptions = this.buildQueryOptions(query, rowIndex, options);
    const transaction: QueryTransaction = {
      query,
      resultType,
      rowIndex,
      id: generateQueryKey(),
      done: false,
      latency: 0,
      options: queryOptions,
    };

    // Using updater style because we might be modifying queryTransactions in quick succession
    this.setState(state => {
      const { queryTransactions } = state;
      // Discarding existing transactions of same type
      const remainingTransactions = queryTransactions.filter(
        qt => !(qt.resultType === resultType && qt.rowIndex === rowIndex)
      );

      // Append new transaction
      const nextQueryTransactions = [...remainingTransactions, transaction];

      return {
        queryTransactions: nextQueryTransactions,
      };
    });

    return transaction;
  }

  completeQueryTransaction(
    transactionId: string,
    result: any,
    latency: number,
    queries: string[],
    datasourceId: string
  ) {
    const { datasource } = this.state;
    if (datasource.meta.id !== datasourceId) {
      // Navigated away, queries did not matter
      return;
    }

    this.setState(state => {
      const { history, queryTransactions } = state;

      // Transaction might have been discarded
      const transaction = queryTransactions.find(qt => qt.id === transactionId);
      if (!transaction) {
        return null;
      }

      // Get query hints
      let hints;
      if (datasource.getQueryHints) {
        hints = datasource.getQueryHints(transaction.query, result);
      }

      // Mark transactions as complete
      const nextQueryTransactions = queryTransactions.map(qt => {
        if (qt.id === transactionId) {
          return {
            ...qt,
            hints,
            latency,
            result,
            done: true,
          };
        }
        return qt;
      });

      const nextHistory = updateHistory(history, datasourceId, queries);

      return {
        history: nextHistory,
        queryTransactions: nextQueryTransactions,
      };
    });
  }

  discardTransactions(rowIndex: number) {
    this.setState(state => {
      const remainingTransactions = state.queryTransactions.filter(qt => qt.rowIndex !== rowIndex);
      return { queryTransactions: remainingTransactions };
    });
  }

  failQueryTransaction(transactionId: string, error: string, datasourceId: string) {
    const { datasource } = this.state;
    if (datasource.meta.id !== datasourceId) {
      // Navigated away, queries did not matter
      return;
    }

    this.setState(state => {
      // Transaction might have been discarded
      if (!state.queryTransactions.find(qt => qt.id === transactionId)) {
        return null;
      }

      // Mark transactions as complete
      const nextQueryTransactions = state.queryTransactions.map(qt => {
        if (qt.id === transactionId) {
          return {
            ...qt,
            error,
            done: true,
          };
        }
        return qt;
      });

      return {
        queryTransactions: nextQueryTransactions,
      };
    });
  }

  async runGraphQueries() {
    const queries = [...this.queryExpressions];
    if (!hasQuery(queries)) {
      return;
    }
    const { datasource } = this.state;
    const datasourceId = datasource.meta.id;
    // Run all queries concurrently
    queries.forEach(async (query, rowIndex) => {
      if (query) {
        const transaction = this.startQueryTransaction(query, rowIndex, 'Graph', {
          format: 'time_series',
          instant: false,
        });
        try {
          const now = Date.now();
          const res = await datasource.query(transaction.options);
          const latency = Date.now() - now;
          const results = makeTimeSeriesList(res.data, transaction.options);
          this.completeQueryTransaction(transaction.id, results, latency, queries, datasourceId);
          this.setState({ graphRange: transaction.options.range });
        } catch (response) {
          console.error(response);
          const queryError = response.data ? response.data.error : response;
          this.failQueryTransaction(transaction.id, queryError, datasourceId);
        }
      } else {
        this.discardTransactions(rowIndex);
      }
    });
  }

  async runTableQuery() {
    const queries = [...this.queryExpressions];
    if (!hasQuery(queries)) {
      return;
    }
    const { datasource } = this.state;
    const datasourceId = datasource.meta.id;
    // Run all queries concurrently
    queries.forEach(async (query, rowIndex) => {
      if (query) {
        const transaction = this.startQueryTransaction(query, rowIndex, 'Table', {
          format: 'table',
          instant: true,
          valueWithRefId: true,
        });
        try {
          const now = Date.now();
          const res = await datasource.query(transaction.options);
          const latency = Date.now() - now;
          const results = res.data[0];
          this.completeQueryTransaction(transaction.id, results, latency, queries, datasourceId);
        } catch (response) {
          console.error(response);
          const queryError = response.data ? response.data.error : response;
          this.failQueryTransaction(transaction.id, queryError, datasourceId);
        }
      } else {
        this.discardTransactions(rowIndex);
      }
    });
  }

  async runLogsQuery() {
    const queries = [...this.queryExpressions];
    if (!hasQuery(queries)) {
      return;
    }
    const { datasource } = this.state;
    const datasourceId = datasource.meta.id;
    // Run all queries concurrently
    queries.forEach(async (query, rowIndex) => {
      if (query) {
        const transaction = this.startQueryTransaction(query, rowIndex, 'Logs', { format: 'logs' });
        try {
          const now = Date.now();
          const res = await datasource.query(transaction.options);
          const latency = Date.now() - now;
          const results = res.data;
          this.completeQueryTransaction(transaction.id, results, latency, queries, datasourceId);
        } catch (response) {
          console.error(response);
          const queryError = response.data ? response.data.error : response;
          this.failQueryTransaction(transaction.id, queryError, datasourceId);
        }
      } else {
        this.discardTransactions(rowIndex);
      }
    });
  }

  request = url => {
    const { datasource } = this.state;
    return datasource.metadataRequest(url);
  };

  cloneState(): ExploreState {
    // Copy state, but copy queries including modifications
    return {
      ...this.state,
      queryTransactions: [],
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
      graphRange,
      history,
      queries,
      queryTransactions,
      range,
      showingGraph,
      showingLogs,
      showingTable,
      supportsGraph,
      supportsLogs,
      supportsTable,
    } = this.state;
    const showingBoth = showingGraph && showingTable;
    const graphHeight = showingBoth ? '200px' : '400px';
    const graphButtonActive = showingBoth || showingGraph ? 'active' : '';
    const logsButtonActive = showingLogs ? 'active' : '';
    const tableButtonActive = showingBoth || showingTable ? 'active' : '';
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const selectedDatasource = datasource ? exploreDatasources.find(d => d.label === datasource.name) : undefined;
    const graphLoading = queryTransactions.some(qt => qt.resultType === 'Graph' && !qt.done);
    const tableLoading = queryTransactions.some(qt => qt.resultType === 'Table' && !qt.done);
    const logsLoading = queryTransactions.some(qt => qt.resultType === 'Logs' && !qt.done);
    const graphResult = _.flatten(
      queryTransactions.filter(qt => qt.resultType === 'Graph' && qt.done && qt.result).map(qt => qt.result)
    );
    const tableResult = mergeTablesIntoModel(
      new TableModel(),
      ...queryTransactions.filter(qt => qt.resultType === 'Table' && qt.done).map(qt => qt.result)
    );
    const logsResult = _.flatten(
      queryTransactions.filter(qt => qt.resultType === 'Logs' && qt.done).map(qt => qt.result)
    );
    const loading = queryTransactions.some(qt => !qt.done);

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
              Run Query{' '}
              {loading ? <i className="fa fa-spinner fa-spin run-icon" /> : <i className="fa fa-level-down run-icon" />}
            </button>
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
              request={this.request}
              onAddQueryRow={this.onAddQueryRow}
              onChangeQuery={this.onChangeQuery}
              onClickHintFix={this.onModifyQueries}
              onExecuteQuery={this.onSubmit}
              onRemoveQueryRow={this.onRemoveQueryRow}
              supportsLogs={supportsLogs}
              transactions={queryTransactions}
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
                showingGraph && (
                  <Graph
                    data={graphResult}
                    height={graphHeight}
                    loading={graphLoading}
                    id={`explore-graph-${position}`}
                    range={graphRange}
                    split={split}
                  />
                )}
              {supportsTable && showingTable ? (
                <div className="panel-container m-t-2">
                  <Table data={tableResult} loading={tableLoading} onClickCell={this.onClickTableCell} />
                </div>
              ) : null}
              {supportsLogs && showingLogs ? <Logs data={logsResult} loading={logsLoading} /> : null}
            </main>
          </div>
        ) : null}
      </div>
    );
  }
}

export default hot(module)(Explore);
