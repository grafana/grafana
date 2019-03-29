// Libraries
import React, { PureComponent } from 'react';
// @ts-ignore
import _ from 'lodash';
import { hot } from 'react-hot-loader';
// @ts-ignore
import { connect } from 'react-redux';

// Components
import QueryEditor from './QueryEditor';
import QueryTransactionStatus from './QueryTransactionStatus';

// Actions
import { changeQuery, modifyQueries, runQueries, addQueryRow } from './state/actions';

// Types
import { StoreState } from 'app/types';
import {
  RawTimeRange,
  DataQuery,
  ExploreDataSourceApi,
  QueryHint,
  QueryFixAction,
  DatasourceStatus,
} from '@grafana/ui';
import { QueryTransaction, HistoryItem, ExploreItemState, ExploreId } from 'app/types/explore';
import { Emitter } from 'app/core/utils/emitter';
import { highlightLogsExpressionAction, removeQueryRowAction } from './state/actionTypes';

function getFirstHintFromTransactions(transactions: QueryTransaction[]): QueryHint {
  const transaction = transactions.find(qt => qt.hints && qt.hints.length > 0);
  if (transaction) {
    return transaction.hints[0];
  }
  return undefined;
}

interface QueryRowProps {
  addQueryRow: typeof addQueryRow;
  changeQuery: typeof changeQuery;
  className?: string;
  exploreId: ExploreId;
  datasourceInstance: ExploreDataSourceApi;
  datasourceStatus: DatasourceStatus;
  highlightLogsExpressionAction: typeof highlightLogsExpressionAction;
  history: HistoryItem[];
  index: number;
  query: DataQuery;
  modifyQueries: typeof modifyQueries;
  queryTransactions: QueryTransaction[];
  exploreEvents: Emitter;
  range: RawTimeRange;
  removeQueryRowAction: typeof removeQueryRowAction;
  runQueries: typeof runQueries;
}

export class QueryRow extends PureComponent<QueryRowProps> {
  onExecuteQuery = () => {
    const { exploreId } = this.props;
    this.props.runQueries(exploreId);
  };

  onChangeQuery = (query: DataQuery, override?: boolean) => {
    const { datasourceInstance, exploreId, index } = this.props;
    this.props.changeQuery(exploreId, query, index, override);
    if (query && !override && datasourceInstance.getHighlighterExpression && index === 0) {
      // Live preview of log search matches. Only use on first row for now
      this.updateLogsHighlights(query);
    }
  };

  componentWillUnmount() {
    console.log('QueryRow will unmount');
  }

  onClickAddButton = () => {
    const { exploreId, index } = this.props;
    this.props.addQueryRow(exploreId, index);
  };

  onClickClearButton = () => {
    this.onChangeQuery(null, true);
  };

  onClickHintFix = (action: QueryFixAction) => {
    const { datasourceInstance, exploreId, index } = this.props;
    if (datasourceInstance && datasourceInstance.modifyQuery) {
      const modifier = (queries: DataQuery, action: QueryFixAction) => datasourceInstance.modifyQuery(queries, action);
      this.props.modifyQueries(exploreId, action, index, modifier);
    }
  };

  onClickRemoveButton = () => {
    const { exploreId, index } = this.props;
    this.props.removeQueryRowAction({ exploreId, index });
  };

  updateLogsHighlights = _.debounce((value: DataQuery) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance.getHighlighterExpression) {
      const { exploreId } = this.props;
      const expressions = [datasourceInstance.getHighlighterExpression(value)];
      this.props.highlightLogsExpressionAction({ exploreId, expressions });
    }
  }, 500);

  render() {
    const {
      datasourceInstance,
      history,
      index,
      query,
      queryTransactions,
      exploreEvents,
      range,
      datasourceStatus,
    } = this.props;
    const transactions = queryTransactions.filter(t => t.rowIndex === index);
    const transactionWithError = transactions.find(t => t.error !== undefined);
    const hint = getFirstHintFromTransactions(transactions);
    const queryError = transactionWithError ? transactionWithError.error : null;
    const QueryField = datasourceInstance.pluginExports.ExploreQueryField;
    return (
      <div className="query-row">
        <div className="query-row-status">
          <QueryTransactionStatus transactions={transactions} />
        </div>
        <div className="query-row-field flex-shrink-1">
          {QueryField ? (
            <QueryField
              datasource={datasourceInstance}
              datasourceStatus={datasourceStatus}
              query={query}
              error={queryError}
              hint={hint}
              history={history}
              onExecuteQuery={this.onExecuteQuery}
              onExecuteHint={this.onClickHintFix}
              onQueryChange={this.onChangeQuery}
            />
          ) : (
            <QueryEditor
              datasource={datasourceInstance}
              error={queryError}
              onQueryChange={this.onChangeQuery}
              onExecuteQuery={this.onExecuteQuery}
              initialQuery={query}
              exploreEvents={exploreEvents}
              range={range}
            />
          )}
        </div>
        <div className="gf-form-inline flex-shrink-0">
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickClearButton}>
              <i className="fa fa-times" />
            </button>
          </div>
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickAddButton}>
              <i className="fa fa-plus" />
            </button>
          </div>
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickRemoveButton}>
              <i className="fa fa-minus" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId, index }: QueryRowProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { datasourceInstance, history, queries, queryTransactions, range, datasourceError } = item;
  const query = queries[index];
  return {
    datasourceInstance,
    history,
    query,
    queryTransactions,
    range,
    datasourceStatus: datasourceError ? DatasourceStatus.Disconnected : DatasourceStatus.Connected,
  };
}

const mapDispatchToProps = {
  addQueryRow,
  changeQuery,
  highlightLogsExpressionAction,
  modifyQueries,
  removeQueryRowAction,
  runQueries,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(QueryRow)
);
