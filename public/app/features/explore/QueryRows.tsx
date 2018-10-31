import React, { PureComponent } from 'react';

import { QueryTransaction, HistoryItem, Query, QueryHint } from 'app/types/explore';

import DefaultQueryField from './QueryField';
import QueryTransactionStatus from './QueryTransactionStatus';
import { DataSource } from 'app/types';

function getFirstHintFromTransactions(transactions: QueryTransaction[]): QueryHint {
  const transaction = transactions.find(qt => qt.hints && qt.hints.length > 0);
  if (transaction) {
    return transaction.hints[0];
  }
  return undefined;
}

interface QueryRowEventHandlers {
  onAddQueryRow: (index: number) => void;
  onChangeQuery: (value: string, index: number, override?: boolean) => void;
  onClickHintFix: (action: object, index?: number) => void;
  onExecuteQuery: () => void;
  onRemoveQueryRow: (index: number) => void;
}

interface QueryRowCommonProps {
  className?: string;
  datasource: DataSource;
  history: HistoryItem[];
  transactions: QueryTransaction[];
}

type QueryRowProps = QueryRowCommonProps &
  QueryRowEventHandlers & {
    index: number;
    query: string;
  };

class QueryRow extends PureComponent<QueryRowProps> {
  onChangeQuery = (value, override?: boolean) => {
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
    this.onChangeQuery('', true);
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
    const { datasource, history, query, transactions } = this.props;
    const transactionWithError = transactions.find(t => t.error !== undefined);
    const hint = getFirstHintFromTransactions(transactions);
    const queryError = transactionWithError ? transactionWithError.error : null;
    const QueryField = datasource.pluginExports.ExploreQueryField || DefaultQueryField;
    return (
      <div className="query-row">
        <div className="query-row-status">
          <QueryTransactionStatus transactions={transactions} />
        </div>
        <div className="query-row-field">
          <QueryField
            datasource={datasource}
            error={queryError}
            hint={hint}
            initialQuery={query}
            history={history}
            onClickHintFix={this.onClickHintFix}
            onPressEnter={this.onPressEnter}
            onQueryChange={this.onChangeQuery}
          />
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
    queries: Query[];
  };

export default class QueryRows extends PureComponent<QueryRowsProps> {
  render() {
    const { className = '', queries, transactions, ...handlers } = this.props;
    return (
      <div className={className}>
        {queries.map((q, index) => (
          <QueryRow
            key={q.key}
            index={index}
            query={q.query}
            transactions={transactions.filter(t => t.rowIndex === index)}
            {...handlers}
          />
        ))}
      </div>
    );
  }
}
