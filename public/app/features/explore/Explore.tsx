import React from 'react';
import { hot } from 'react-hot-loader';
import Select from 'react-select';
import _ from 'lodash';

import { DataSource } from 'app/types/datasources';
import {
  ExploreState,
  ExploreUrlState,
  QueryTransaction,
  ResultType,
  QueryHintGetter,
  QueryHint,
} from 'app/types/explore';
import { RawTimeRange, DataQuery } from 'app/types/series';
import store from 'app/core/store';
import {
  DEFAULT_RANGE,
  calculateResultsFromQueryTransactions,
  ensureQueries,
  getIntervals,
  generateKey,
  generateQueryKeys,
  hasNonEmptyQuery,
  makeTimeSeriesList,
  updateHistory,
} from 'app/core/utils/explore';
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import PickerOption from 'app/core/components/Picker/PickerOption';
import IndicatorsContainer from 'app/core/components/Picker/IndicatorsContainer';
import NoOptionsMessage from 'app/core/components/Picker/NoOptionsMessage';
import TableModel from 'app/core/table_model';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

import Panel from './Panel';
import QueryRows from './QueryRows';
import Graph from './Graph';
import Logs from './Logs';
import Table from './Table';
import ErrorBoundary from './ErrorBoundary';
import TimePicker from './TimePicker';

interface ExploreProps {
  datasourceSrv: DatasourceSrv;
  onChangeSplit: (split: boolean, state?: ExploreState) => void;
  onSaveState: (key: string, state: ExploreState) => void;
  position: string;
  split: boolean;
  splitState?: ExploreState;
  stateKey: string;
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
 * on the screen. Query rows can be initialized or reset using `initialQueries`,
 * by giving the respective row a new key. This wipes the old row and its state.
 * This property is also used to govern how many query rows there are (minimum 1).
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
export class Explore extends React.PureComponent<ExploreProps, ExploreState> {
  el: any;
  /**
   * Current query expressions of the rows including their modifications, used for running queries.
   * Not kept in component state to prevent edit-render roundtrips.
   */
  modifiedQueries: DataQuery[];
  /**
   * Local ID cache to compare requested vs selected datasource
   */
  requestedDatasourceId: string;
  scanTimer: NodeJS.Timer;
  /**
   * Timepicker to control scanning
   */
  timepickerRef: React.RefObject<TimePicker>;

  constructor(props) {
    super(props);
    const splitState: ExploreState = props.splitState;
    let initialQueries: DataQuery[];
    if (splitState) {
      // Split state overrides everything
      this.state = splitState;
      initialQueries = splitState.initialQueries;
    } else {
      const { datasource, queries, range } = props.urlState as ExploreUrlState;
      initialQueries = ensureQueries(queries);
      const initialRange = range || { ...DEFAULT_RANGE };
      // Millies step for helper bar charts
      const initialGraphInterval = 15 * 1000;
      this.state = {
        datasource: null,
        datasourceError: null,
        datasourceLoading: null,
        datasourceMissing: false,
        datasourceName: datasource,
        exploreDatasources: [],
        graphInterval: initialGraphInterval,
        graphResult: [],
        initialQueries,
        history: [],
        logsResult: null,
        queryTransactions: [],
        range: initialRange,
        scanning: false,
        showingGraph: true,
        showingLogs: true,
        showingStartPage: false,
        showingTable: true,
        supportsGraph: null,
        supportsLogs: null,
        supportsTable: null,
        tableResult: new TableModel(),
      };
    }
    this.modifiedQueries = initialQueries.slice();
    this.timepickerRef = React.createRef();
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

  componentWillUnmount() {
    clearTimeout(this.scanTimer);
  }

  async setDatasource(datasource: any, origin?: DataSource) {
    const { initialQueries, range } = this.state;

    const supportsGraph = datasource.meta.metrics;
    const supportsLogs = datasource.meta.logs;
    const supportsTable = datasource.meta.metrics;
    const datasourceId = datasource.meta.id;
    let datasourceError = null;

    // Keep ID to track selection
    this.requestedDatasourceId = datasourceId;

    try {
      const testResult = await datasource.testDatasource();
      datasourceError = testResult.status === 'success' ? null : testResult.message;
    } catch (error) {
      datasourceError = (error && error.statusText) || 'Network error';
    }

    if (datasourceId !== this.requestedDatasourceId) {
      // User already changed datasource again, discard results
      return;
    }

    const historyKey = `grafana.explore.history.${datasourceId}`;
    const history = store.getObject(historyKey, []);

    if (datasource.init) {
      datasource.init();
    }

    // Check if queries can be imported from previously selected datasource
    let modifiedQueries = this.modifiedQueries;
    if (origin) {
      if (origin.meta.id === datasource.meta.id) {
        // Keep same queries if same type of datasource
        modifiedQueries = [...this.modifiedQueries];
      } else if (datasource.importQueries) {
        // Datasource-specific importers
        modifiedQueries = await datasource.importQueries(this.modifiedQueries, origin.meta);
      } else {
        // Default is blank queries
        modifiedQueries = ensureQueries();
      }
    }

    // Reset edit state with new queries
    const nextQueries = initialQueries.map((q, i) => ({
      ...modifiedQueries[i],
      ...generateQueryKeys(i),
    }));
    this.modifiedQueries = modifiedQueries;

    // Custom components
    const StartPage = datasource.pluginExports.ExploreStartPage;

    // Calculate graph bucketing interval
    const graphInterval = getIntervals(range, datasource, this.el ? this.el.offsetWidth : 0).intervalMs;

    this.setState(
      {
        StartPage,
        datasource,
        datasourceError,
        graphInterval,
        history,
        supportsGraph,
        supportsLogs,
        supportsTable,
        datasourceLoading: false,
        datasourceName: datasource.name,
        initialQueries: nextQueries,
        showingStartPage: Boolean(StartPage),
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
    this.modifiedQueries[index + 1] = { ...generateQueryKeys(index + 1) };

    this.setState(state => {
      const { initialQueries, queryTransactions } = state;

      const nextQueries = [
        ...initialQueries.slice(0, index + 1),
        { ...this.modifiedQueries[index + 1] },
        ...initialQueries.slice(index + 1),
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

      return { initialQueries: nextQueries, queryTransactions: nextQueryTransactions };
    });
  };

  onChangeDatasource = async option => {
    const origin = this.state.datasource;
    this.setState({
      datasource: null,
      datasourceError: null,
      datasourceLoading: true,
      queryTransactions: [],
    });
    const datasourceName = option.value;
    const datasource = await this.props.datasourceSrv.get(datasourceName);
    this.setDatasource(datasource as any, origin);
  };

  onChangeQuery = (value: DataQuery, index: number, override?: boolean) => {
    // Null value means reset
    if (value === null) {
      value = { ...generateQueryKeys(index) };
    }

    // Keep current value in local cache
    this.modifiedQueries[index] = value;

    if (override) {
      this.setState(state => {
        // Replace query row by injecting new key
        const { initialQueries, queryTransactions } = state;
        const query: DataQuery = {
          ...value,
          ...generateQueryKeys(index),
        };
        const nextQueries = [...initialQueries];
        nextQueries[index] = query;
        this.modifiedQueries = [...nextQueries];

        // Discard ongoing transaction related to row query
        const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);

        return {
          initialQueries: nextQueries,
          queryTransactions: nextQueryTransactions,
        };
      }, this.onSubmit);
    }
  };

  onChangeTime = (nextRange: RawTimeRange, scanning?: boolean) => {
    const range: RawTimeRange = {
      ...nextRange,
    };
    if (this.state.scanning && !scanning) {
      this.onStopScanning();
    }
    this.setState({ range, scanning }, () => this.onSubmit());
  };

  onClickClear = () => {
    this.modifiedQueries = ensureQueries();
    this.setState(
      prevState => ({
        initialQueries: [...this.modifiedQueries],
        queryTransactions: [],
        showingStartPage: Boolean(prevState.StartPage),
      }),
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

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    const nextQueries = [{ ...query, ...generateQueryKeys() }];
    this.modifiedQueries = [...nextQueries];
    this.setState({ initialQueries: nextQueries }, this.onSubmit);
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
        if (showingTable) {
          return { showingTable, queryTransactions: state.queryTransactions };
        }

        // Toggle off needs discarding of table queries
        const nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Table');
        const results = calculateResultsFromQueryTransactions(
          nextQueryTransactions,
          state.datasource,
          state.graphInterval
        );

        return { ...results, queryTransactions: nextQueryTransactions, showingTable };
      },
      () => {
        if (this.state.showingTable) {
          this.onSubmit();
        }
      }
    );
  };

  onClickLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', key, value });
  };

  onModifyQueries = (action, index?: number) => {
    const { datasource } = this.state;
    if (datasource && datasource.modifyQuery) {
      const preventSubmit = action.preventSubmit;
      this.setState(
        state => {
          const { initialQueries, queryTransactions } = state;
          let nextQueries: DataQuery[];
          let nextQueryTransactions;
          if (index === undefined) {
            // Modify all queries
            nextQueries = initialQueries.map((query, i) => ({
              ...datasource.modifyQuery(this.modifiedQueries[i], action),
              ...generateQueryKeys(i),
            }));
            // Discard all ongoing transactions
            nextQueryTransactions = [];
          } else {
            // Modify query only at index
            nextQueries = initialQueries.map((query, i) => {
              // Synchronise all queries with local query cache to ensure consistency
              // TODO still needed?
              return i === index
                ? {
                    ...datasource.modifyQuery(this.modifiedQueries[i], action),
                    ...generateQueryKeys(i),
                  }
                : query;
            });
            nextQueryTransactions = queryTransactions
              // Consume the hint corresponding to the action
              .map(qt => {
                if (qt.hints != null && qt.rowIndex === index) {
                  qt.hints = qt.hints.filter(hint => hint.fix.action !== action);
                }
                return qt;
              })
              // Preserve previous row query transaction to keep results visible if next query is incomplete
              .filter(qt => preventSubmit || qt.rowIndex !== index);
          }
          this.modifiedQueries = [...nextQueries];
          return {
            initialQueries: nextQueries,
            queryTransactions: nextQueryTransactions,
          };
        },
        // Accepting certain fixes do not result in a well-formed query which should not be submitted
        !preventSubmit ? () => this.onSubmit() : null
      );
    }
  };

  onRemoveQueryRow = index => {
    // Remove from local cache
    this.modifiedQueries = [...this.modifiedQueries.slice(0, index), ...this.modifiedQueries.slice(index + 1)];

    this.setState(
      state => {
        const { initialQueries, queryTransactions } = state;
        if (initialQueries.length <= 1) {
          return null;
        }
        // Remove row from react state
        const nextQueries = [...initialQueries.slice(0, index), ...initialQueries.slice(index + 1)];

        // Discard transactions related to row query
        const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);
        const results = calculateResultsFromQueryTransactions(
          nextQueryTransactions,
          state.datasource,
          state.graphInterval
        );

        return {
          ...results,
          initialQueries: nextQueries,
          queryTransactions: nextQueryTransactions,
        };
      },
      () => this.onSubmit()
    );
  };

  onStartScanning = () => {
    this.setState({ scanning: true }, this.scanPreviousRange);
  };

  scanPreviousRange = () => {
    const scanRange = this.timepickerRef.current.move(-1, true);
    this.setState({ scanRange });
  };

  onStopScanning = () => {
    clearTimeout(this.scanTimer);
    this.setState(state => {
      const { queryTransactions } = state;
      const nextQueryTransactions = queryTransactions.filter(qt => qt.scanning && !qt.done);
      return { queryTransactions: nextQueryTransactions, scanning: false, scanRange: undefined };
    });
  };

  onSubmit = () => {
    const { showingLogs, showingGraph, showingTable, supportsGraph, supportsLogs, supportsTable } = this.state;
    // Keep table queries first since they need to return quickly
    if (showingTable && supportsTable) {
      this.runQueries(
        'Table',
        {
          format: 'table',
          instant: true,
          valueWithRefId: true,
        },
        data => data[0]
      );
    }
    if (showingGraph && supportsGraph) {
      this.runQueries(
        'Graph',
        {
          format: 'time_series',
          instant: false,
        },
        makeTimeSeriesList
      );
    }
    if (showingLogs && supportsLogs) {
      this.runQueries('Logs', { format: 'logs' });
    }
    this.saveState();
  };

  buildQueryOptions(query: DataQuery, queryOptions: { format: string; hinting?: boolean; instant?: boolean }) {
    const { datasource, range } = this.state;
    const { interval, intervalMs } = getIntervals(range, datasource, this.el.offsetWidth);

    const configuredQueries = [
      {
        ...query,
        ...queryOptions,
      },
    ];

    // Clone range for query request
    const queryRange: RawTimeRange = { ...range };

    // Datasource is using `panelId + query.refId` for cancellation logic.
    // Using `format` here because it relates to the view panel that the request is for.
    const panelId = queryOptions.format;

    return {
      interval,
      intervalMs,
      panelId,
      targets: configuredQueries, // Datasources rely on DataQueries being passed under the targets key.
      range: queryRange,
    };
  }

  startQueryTransaction(query: DataQuery, rowIndex: number, resultType: ResultType, options: any): QueryTransaction {
    const queryOptions = this.buildQueryOptions(query, options);
    const transaction: QueryTransaction = {
      query,
      resultType,
      rowIndex,
      id: generateKey(), // reusing for unique ID
      done: false,
      latency: 0,
      options: queryOptions,
      scanning: this.state.scanning,
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

      const results = calculateResultsFromQueryTransactions(
        nextQueryTransactions,
        state.datasource,
        state.graphInterval
      );

      return {
        ...results,
        queryTransactions: nextQueryTransactions,
        showingStartPage: false,
      };
    });

    return transaction;
  }

  completeQueryTransaction(
    transactionId: string,
    result: any,
    latency: number,
    queries: DataQuery[],
    datasourceId: string
  ) {
    const { datasource } = this.state;
    if (datasource.meta.id !== datasourceId) {
      // Navigated away, queries did not matter
      return;
    }

    this.setState(state => {
      const { history, queryTransactions, scanning } = state;

      // Transaction might have been discarded
      const transaction = queryTransactions.find(qt => qt.id === transactionId);
      if (!transaction) {
        return null;
      }

      // Get query hints
      let hints: QueryHint[];
      if (datasource.getQueryHints as QueryHintGetter) {
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

      const results = calculateResultsFromQueryTransactions(
        nextQueryTransactions,
        state.datasource,
        state.graphInterval
      );

      const nextHistory = updateHistory(history, datasourceId, queries);

      // Keep scanning for results if this was the last scanning transaction
      if (_.size(result) === 0 && scanning) {
        const other = nextQueryTransactions.find(qt => qt.scanning && !qt.done);
        if (!other) {
          this.scanTimer = setTimeout(this.scanPreviousRange, 1000);
        }
      }

      return {
        ...results,
        history: nextHistory,
        queryTransactions: nextQueryTransactions,
      };
    });
  }

  failQueryTransaction(transactionId: string, response: any, datasourceId: string) {
    const { datasource } = this.state;
    if (datasource.meta.id !== datasourceId || response.cancelled) {
      // Navigated away, queries did not matter
      return;
    }

    console.error(response);

    let error: string | JSX.Element = response;
    if (response.data) {
      if (typeof response.data === 'string') {
        error = response.data;
      } else if (response.data.error) {
        error = response.data.error;
        if (response.data.response) {
          error = (
            <>
              <span>{response.data.error}</span>
              <details>{response.data.response}</details>
            </>
          );
        }
      } else {
        throw new Error('Could not handle error response');
      }
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

  async runQueries(resultType: ResultType, queryOptions: any, resultGetter?: any) {
    const queries = [...this.modifiedQueries];
    if (!hasNonEmptyQuery(queries)) {
      return;
    }
    const { datasource } = this.state;
    const datasourceId = datasource.meta.id;
    // Run all queries concurrently
    queries.forEach(async (query, rowIndex) => {
      const transaction = this.startQueryTransaction(query, rowIndex, resultType, queryOptions);
      try {
        const now = Date.now();
        const res = await datasource.query(transaction.options);
        const latency = Date.now() - now;
        const results = resultGetter ? resultGetter(res.data) : res.data;
        this.completeQueryTransaction(transaction.id, results, latency, queries, datasourceId);
      } catch (response) {
        this.failQueryTransaction(transaction.id, response, datasourceId);
      }
    });
  }

  cloneState(): ExploreState {
    // Copy state, but copy queries including modifications
    return {
      ...this.state,
      queryTransactions: [],
      initialQueries: [...this.modifiedQueries],
    };
  }

  saveState = () => {
    const { stateKey, onSaveState } = this.props;
    onSaveState(stateKey, this.cloneState());
  };

  render() {
    const { position, split } = this.props;
    const {
      StartPage,
      datasource,
      datasourceError,
      datasourceLoading,
      datasourceMissing,
      exploreDatasources,
      graphResult,
      history,
      initialQueries,
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
    } = this.state;
    const graphHeight = showingGraph && showingTable ? '200px' : '400px';
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const selectedDatasource = datasource ? exploreDatasources.find(d => d.label === datasource.name) : undefined;
    const graphLoading = queryTransactions.some(qt => qt.resultType === 'Graph' && !qt.done);
    const tableLoading = queryTransactions.some(qt => qt.resultType === 'Table' && !qt.done);
    const logsLoading = queryTransactions.some(qt => qt.resultType === 'Logs' && !qt.done);
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
          <TimePicker ref={this.timepickerRef} range={range} onChangeTime={this.onChangeTime} />
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
              datasource={datasource}
              history={history}
              initialQueries={initialQueries}
              onAddQueryRow={this.onAddQueryRow}
              onChangeQuery={this.onChangeQuery}
              onClickHintFix={this.onModifyQueries}
              onExecuteQuery={this.onSubmit}
              onRemoveQueryRow={this.onRemoveQueryRow}
              transactions={queryTransactions}
            />
            <main className="m-t-2">
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
                          id={`explore-graph-${position}`}
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
                      <Panel label="Logs" loading={logsLoading} isOpen={showingLogs} onToggle={this.onClickLogsButton}>
                        <Logs
                          data={logsResult}
                          key={logsResult.id}
                          loading={logsLoading}
                          position={position}
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
          </div>
        ) : null}
      </div>
    );
  }
}

export default hot(module)(Explore);
