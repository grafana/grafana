import React, { PureComponent } from 'react';

import { QueryTransaction } from 'app/types/explore';

// TODO make this datasource-plugin-dependent
import QueryField from './PromQueryField';
import QueryTransactions from './QueryTransactions';

function getFirstHintFromTransactions(transactions: QueryTransaction[]) {
  const transaction = transactions.find(qt => qt.hints && qt.hints.length > 0);
  if (transaction) {
    return transaction.hints[0];
  }
  return undefined;
}

class QueryRow extends PureComponent<any, {}> {
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
    const { history, query, request, supportsLogs, transactions } = this.props;
    const transactionWithError = transactions.find(t => t.error);
    const hint = getFirstHintFromTransactions(transactions);
    const queryError = transactionWithError ? transactionWithError.error : null;
    return (
      <div className="query-row">
        <div className="query-row-status">
          <QueryTransactions transactions={transactions} />
        </div>
        <div className="query-row-field">
          <QueryField
            error={queryError}
            hint={hint}
            initialQuery={query}
            history={history}
            onClickHintFix={this.onClickHintFix}
            onPressEnter={this.onPressEnter}
            onQueryChange={this.onChangeQuery}
            request={request}
            supportsLogs={supportsLogs}
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

export default class QueryRows extends PureComponent<any, {}> {
  render() {
    const { className = '', queries, queryHints, transactions, ...handlers } = this.props;
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
