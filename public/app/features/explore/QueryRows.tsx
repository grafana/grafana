import React, { PureComponent } from 'react';

import { QueryTransaction, HistoryItem, QueryHint } from 'app/types/explore';
import { Emitter } from 'app/core/utils/emitter';

// import DefaultQueryField from './QueryField';
import QueryEditor from './QueryEditor';
import QueryTransactionStatus from './QueryTransactionStatus';
import { DataSource, DataQuery } from 'app/types';

function getFirstHintFromTransactions(transactions: QueryTransaction[]): QueryHint {
  const transaction = transactions.find(qt => qt.hints && qt.hints.length > 0);
  if (transaction) {
    return transaction.hints[0];
  }
  return undefined;
}

interface QueryRowEventHandlers {
  onAddQueryRow: (index: number) => void;
  onChangeQuery: (value: DataQuery, index: number, override?: boolean) => void;
  onClickHintFix: (action: object, index?: number) => void;
  onExecuteQuery: () => void;
  onRemoveQueryRow: (index: number) => void;
}

interface QueryRowCommonProps {
  className?: string;
  datasource: DataSource;
  history: HistoryItem[];
  transactions: QueryTransaction[];
  exploreEvents: Emitter;
}

type QueryRowProps = QueryRowCommonProps &
  QueryRowEventHandlers & {
    index: number;
    initialQuery: DataQuery;
  };

class QueryRow extends PureComponent<QueryRowProps> {
  onExecuteQuery = () => {
    const { onExecuteQuery } = this.props;
    onExecuteQuery();
  };

  onChangeQuery = (value: DataQuery, override?: boolean) => {
    const { index, onChangeQuery } = this.props;
    if (onChangeQuery) {
      onChangeQuery(value, index, override);
    }
  };

  onClickAddButton = () => {
    const { index, onAddQueryRow } = this.props;
    if (onAddQueryRow) {
      onAddQueryRow(index);
    }
  };

  onClickClearButton = () => {
    this.onChangeQuery(null, true);
  };

  onClickHintFix = action => {
    const { index, onClickHintFix } = this.props;
    if (onClickHintFix) {
      onClickHintFix(action, index);
    }
  };

  onClickRemoveButton = () => {
    const { index, onRemoveQueryRow } = this.props;
    if (onRemoveQueryRow) {
      onRemoveQueryRow(index);
    }
  };

  onPressEnter = () => {
    const { onExecuteQuery } = this.props;
    if (onExecuteQuery) {
      onExecuteQuery();
    }
  };

  render() {
    const { datasource, history, initialQuery, transactions, exploreEvents } = this.props;
    const transactionWithError = transactions.find(t => t.error !== undefined);
    const hint = getFirstHintFromTransactions(transactions);
    const queryError = transactionWithError ? transactionWithError.error : null;
    // const QueryField = datasource.pluginExports.ExploreQueryField || DefaultQueryField;
    const QueryField = datasource.pluginExports.ExploreQueryField;
    // const QueryEditor = datasource.pluginExports.QueryCtrl;
    return (
      <div className="query-row">
        <div className="query-row-status">
          <QueryTransactionStatus transactions={transactions} />
        </div>
        <div className="query-row-field">
          {QueryField ? (
            <QueryField
              datasource={datasource}
              error={queryError}
              hint={hint}
              initialQuery={initialQuery}
              history={history}
              onClickHintFix={this.onClickHintFix}
              onPressEnter={this.onPressEnter}
              onQueryChange={this.onChangeQuery}
            />
          ) : (
            <QueryEditor
              datasource={datasource}
              error={queryError}
              onQueryChange={this.onChangeQuery}
              onExecuteQuery={this.onExecuteQuery}
              initialQuery={initialQuery}
              exploreEvents={exploreEvents}
            />
          )}
        </div>
        <div className="query-row-tools">
          <button className="btn navbar-button navbar-button--tight" onClick={this.onClickClearButton}>
            <i className="fa fa-times" />
          </button>
          <button className="btn navbar-button navbar-button--tight" onClick={this.onClickAddButton}>
            <i className="fa fa-plus" />
          </button>
          <button className="btn navbar-button navbar-button--tight" onClick={this.onClickRemoveButton}>
            <i className="fa fa-minus" />
          </button>
        </div>
      </div>
    );
  }
}

type QueryRowsProps = QueryRowCommonProps &
  QueryRowEventHandlers & {
    initialQueries: DataQuery[];
  };

export default class QueryRows extends PureComponent<QueryRowsProps> {
  render() {
    const { className = '', initialQueries, transactions, ...handlers } = this.props;
    return (
      <div className={className}>
        {initialQueries.map((query, index) => (
          <QueryRow
            key={query.key}
            index={index}
            initialQuery={query}
            transactions={transactions.filter(t => t.rowIndex === index)}
            {...handlers}
          />
        ))}
      </div>
    );
  }
}
