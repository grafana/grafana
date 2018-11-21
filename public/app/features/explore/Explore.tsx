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
  ensureTargets,
  getIntervals,
  generateKey,
  generateTargetKeys,
  hasNonEmptyTarget,
  makeTimeSeriesList,
  updateHistory,
} from 'app/core/utils/explore';
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import PickerOption from 'app/core/components/Picker/PickerOption';
import IndicatorsContainer from 'app/core/components/Picker/IndicatorsContainer';
import NoOptionsMessage from 'app/core/components/Picker/NoOptionsMessage';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
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
 */
export class Explore extends React.PureComponent<ExploreProps, ExploreState> {
  el: any;
  /**
   * Current query expressions of the rows including their modifications, used for running queries.
   * Not kept in component state to prevent edit-render roundtrips.
   */
  modifiedTargets: DataQuery[];
  /**
   * Local ID cache to compare requested vs selected datasource
   */
  requestedDatasourceId: string;

  constructor(props) {
    super(props);
    const splitState: ExploreState = props.splitState;
    let initialTargets: DataQuery[];
    if (splitState) {
      // Split state overrides everything
      this.state = splitState;
      initialTargets = splitState.initialTargets;
    } else {
      const { datasource, targets, range } = props.urlState as ExploreUrlState;
      initialTargets = ensureTargets(targets);
      const initialRange = range || { ...DEFAULT_RANGE };
      this.state = {
        datasource: null,
        datasourceError: null,
        datasourceLoading: null,
        datasourceMissing: false,
        datasourceName: datasource,
        exploreDatasources: [],
        graphRange: initialRange,
        initialTargets,
        history: [],
        queryTransactions: [],
        range: initialRange,
        showingGraph: true,
        showingLogs: true,
        showingStartPage: false,
        showingTable: true,
        supportsGraph: null,
        supportsLogs: null,
        supportsTable: null,
      };
    }
    this.modifiedTargets = initialTargets.slice();
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

  async setDatasource(datasource: any, origin?: DataSource) {
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
    let modifiedTargets = this.modifiedTargets;
    if (origin) {
      if (origin.meta.id === datasource.meta.id) {
        // Keep same queries if same type of datasource
        modifiedTargets = [...this.modifiedTargets];
      } else if (datasource.importQueries) {
        // Datasource-specific importers
        modifiedTargets = await datasource.importQueries(this.modifiedTargets, origin.meta);
      } else {
        // Default is blank queries
        modifiedTargets = ensureTargets();
      }
    }

    // Reset edit state with new queries
    const nextTargets = this.state.initialTargets.map((q, i) => ({
      ...modifiedTargets[i],
      ...generateTargetKeys(i),
    }));
    this.modifiedTargets = modifiedTargets;

    // Custom components
    const StartPage = datasource.pluginExports.ExploreStartPage;

    this.setState(
      {
        StartPage,
        datasource,
        datasourceError,
        history,
        supportsGraph,
        supportsLogs,
        supportsTable,
        datasourceLoading: false,
        datasourceName: datasource.name,
        initialTargets: nextTargets,
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
    this.modifiedTargets[index + 1] = { ...generateTargetKeys(index + 1) };

    this.setState(state => {
      const { initialTargets, queryTransactions } = state;

      const nextTargets = [
        ...initialTargets.slice(0, index + 1),
        { ...this.modifiedTargets[index + 1] },
        ...initialTargets.slice(index + 1),
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

      return { initialTargets: nextTargets, queryTransactions: nextQueryTransactions };
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
    // Keep current value in local cache
    this.modifiedTargets[index] = value;

    if (override) {
      this.setState(state => {
        // Replace query row
        const { initialTargets, queryTransactions } = state;
        const target: DataQuery = {
          ...value,
          ...generateTargetKeys(index),
        };
        const nextTargets = [...initialTargets];
        nextTargets[index] = target;

        // Discard ongoing transaction related to row query
        const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);

        return {
          initialTargets: nextTargets,
          queryTransactions: nextQueryTransactions,
        };
      }, this.onSubmit);
    }
  };

  onChangeTime = (nextRange: RawTimeRange) => {
    const range: RawTimeRange = {
      ...nextRange,
    };
    this.setState({ range }, () => this.onSubmit());
  };

  onClickClear = () => {
    this.modifiedTargets = ensureTargets();
    this.setState(
      prevState => ({
        initialTargets: [...this.modifiedTargets],
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
  onClickExample = (target: DataQuery) => {
    const nextTargets = [{ ...target, ...generateTargetKeys() }];
    this.modifiedTargets = [...nextTargets];
    this.setState({ initialTargets: nextTargets }, this.onSubmit);
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

  onModifyQueries = (action, index?: number) => {
    const { datasource } = this.state;
    if (datasource && datasource.modifyQuery) {
      const preventSubmit = action.preventSubmit;
      this.setState(
        state => {
          const { initialTargets, queryTransactions } = state;
          let nextTargets: DataQuery[];
          let nextQueryTransactions;
          if (index === undefined) {
            // Modify all queries
            nextTargets = initialTargets.map((target, i) => ({
              ...datasource.modifyQuery(this.modifiedTargets[i], action),
              ...generateTargetKeys(i),
            }));
            // Discard all ongoing transactions
            nextQueryTransactions = [];
          } else {
            // Modify query only at index
            nextTargets = initialTargets.map((target, i) => {
              // Synchronise all queries with local query cache to ensure consistency
              // TODO still needed?
              return i === index
                ? {
                    ...datasource.modifyQuery(this.modifiedTargets[i], action),
                    ...generateTargetKeys(i),
                  }
                : target;
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
          this.modifiedTargets = [...nextTargets];
          return {
            initialTargets: nextTargets,
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
    this.modifiedTargets = [...this.modifiedTargets.slice(0, index), ...this.modifiedTargets.slice(index + 1)];

    this.setState(
      state => {
        const { initialTargets, queryTransactions } = state;
        if (initialTargets.length <= 1) {
          return null;
        }
        // Remove row from react state
        const nextTargets = [...initialTargets.slice(0, index), ...initialTargets.slice(index + 1)];

        // Discard transactions related to row query
        const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);

        return {
          initialTargets: nextTargets,
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

  buildQueryOptions(target: DataQuery, targetOptions: { format: string; hinting?: boolean; instant?: boolean }) {
    const { datasource, range } = this.state;
    const { interval, intervalMs } = getIntervals(range, datasource, this.el.offsetWidth);
    const targets = [
      {
        ...targetOptions,
        ...target,
      },
    ];

    // Clone range for query request
    const queryRange: RawTimeRange = { ...range };

    // Datasource is using `panelId + target.refId` for cancellation logic.
    // Using `format` here because it relates to the view panel that the request is for.
    const panelId = targetOptions.format;

    return {
      interval,
      intervalMs,
      panelId,
      targets,
      range: queryRange,
    };
  }

  startQueryTransaction(target: DataQuery, rowIndex: number, resultType: ResultType, options: any): QueryTransaction {
    const queryOptions = this.buildQueryOptions(target, options);
    const transaction: QueryTransaction = {
      target,
      resultType,
      rowIndex,
      id: generateKey(), // reusing for unique ID
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
        showingStartPage: false,
      };
    });

    return transaction;
  }

  completeQueryTransaction(
    transactionId: string,
    result: any,
    latency: number,
    targets: DataQuery[],
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
      let hints: QueryHint[];
      if (datasource.getQueryHints as QueryHintGetter) {
        hints = datasource.getQueryHints(transaction.target, result);
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

      const nextHistory = updateHistory(history, datasourceId, targets);

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

  failQueryTransaction(transactionId: string, response: any, datasourceId: string) {
    const { datasource } = this.state;
    if (datasource.meta.id !== datasourceId || response.cancelled) {
      // Navigated away, queries did not matter
      return;
    }

    console.error(response);

    let error: string | JSX.Element = response;
    if (response.data) {
      error = response.data.error;
      if (response.data.response) {
        error = (
          <>
            <span>{response.data.error}</span>
            <details>{response.data.response}</details>
          </>
        );
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

  async runGraphQueries() {
    const targets = [...this.modifiedTargets];
    if (!hasNonEmptyTarget(targets)) {
      return;
    }
    const { datasource } = this.state;
    const datasourceId = datasource.meta.id;
    // Run all queries concurrently
    targets.forEach(async (target, rowIndex) => {
      const transaction = this.startQueryTransaction(target, rowIndex, 'Graph', {
        format: 'time_series',
        instant: false,
      });
      try {
        const now = Date.now();
        const res = await datasource.query(transaction.options);
        const latency = Date.now() - now;
        const results = makeTimeSeriesList(res.data, transaction.options);
        this.completeQueryTransaction(transaction.id, results, latency, targets, datasourceId);
        this.setState({ graphRange: transaction.options.range });
      } catch (response) {
        this.failQueryTransaction(transaction.id, response, datasourceId);
      }
    });
  }

  async runTableQuery() {
    const targets = [...this.modifiedTargets];
    if (!hasNonEmptyTarget(targets)) {
      return;
    }
    const { datasource } = this.state;
    const datasourceId = datasource.meta.id;
    // Run all queries concurrently
    targets.forEach(async (target, rowIndex) => {
      const transaction = this.startQueryTransaction(target, rowIndex, 'Table', {
        format: 'table',
        instant: true,
        valueWithRefId: true,
      });
      try {
        const now = Date.now();
        const res = await datasource.query(transaction.options);
        const latency = Date.now() - now;
        const results = res.data[0];
        this.completeQueryTransaction(transaction.id, results, latency, targets, datasourceId);
      } catch (response) {
        this.failQueryTransaction(transaction.id, response, datasourceId);
      }
    });
  }

  async runLogsQuery() {
    const targets = [...this.modifiedTargets];
    if (!hasNonEmptyTarget(targets)) {
      return;
    }
    const { datasource } = this.state;
    const datasourceId = datasource.meta.id;
    // Run all queries concurrently
    targets.forEach(async (target, rowIndex) => {
      const transaction = this.startQueryTransaction(target, rowIndex, 'Logs', { format: 'logs' });
      try {
        const now = Date.now();
        const res = await datasource.query(transaction.options);
        const latency = Date.now() - now;
        const results = res.data;
        this.completeQueryTransaction(transaction.id, results, latency, targets, datasourceId);
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
      initialTargets: [...this.modifiedTargets],
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
      graphRange,
      history,
      initialTargets,
      queryTransactions,
      range,
      showingGraph,
      showingLogs,
      showingStartPage,
      showingTable,
      supportsGraph,
      supportsLogs,
      supportsTable,
    } = this.state;
    const graphHeight = showingGraph && showingTable ? '200px' : '400px';
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const selectedDatasource = datasource ? exploreDatasources.find(d => d.label === datasource.name) : undefined;
    const graphRangeIntervals = getIntervals(graphRange, datasource, this.el ? this.el.offsetWidth : 0);
    const graphLoading = queryTransactions.some(qt => qt.resultType === 'Graph' && !qt.done);
    const tableLoading = queryTransactions.some(qt => qt.resultType === 'Table' && !qt.done);
    const logsLoading = queryTransactions.some(qt => qt.resultType === 'Logs' && !qt.done);
    // TODO don't recreate those on each re-render
    const graphResult = _.flatten(
      queryTransactions.filter(qt => qt.resultType === 'Graph' && qt.done && qt.result).map(qt => qt.result)
    );
    const tableResult = mergeTablesIntoModel(
      new TableModel(),
      ...queryTransactions.filter(qt => qt.resultType === 'Table' && qt.done && qt.result).map(qt => qt.result)
    );
    const logsResult =
      datasource && datasource.mergeStreams
        ? datasource.mergeStreams(
            _.flatten(
              queryTransactions.filter(qt => qt.resultType === 'Logs' && qt.done && qt.result).map(qt => qt.result)
            ),
            graphRangeIntervals.intervalMs
          )
        : undefined;
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
              datasource={datasource}
              history={history}
              initialTargets={initialTargets}
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
                          range={graphRange}
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
                        <Table data={tableResult} loading={tableLoading} onClickCell={this.onClickTableCell} />
                      </Panel>
                    )}
                    {supportsLogs && (
                      <Panel label="Logs" loading={logsLoading} isOpen={showingLogs} onToggle={this.onClickLogsButton}>
                        <Logs
                          data={logsResult}
                          loading={logsLoading}
                          position={position}
                          onChangeTime={this.onChangeTime}
                          range={range}
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
