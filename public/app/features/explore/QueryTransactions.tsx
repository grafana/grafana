import React, { PureComponent } from 'react';

import { QueryTransaction as QueryTransactionModel } from 'app/types/explore';
import ElapsedTime from './ElapsedTime';

function formatLatency(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

interface QueryTransactionProps {
  transaction: QueryTransactionModel;
}

class QueryTransaction extends PureComponent<QueryTransactionProps> {
  render() {
    const { transaction } = this.props;
    const className = transaction.done ? 'query-transaction' : 'query-transaction query-transaction--loading';
    return (
      <div className={className}>
        <div className="query-transaction__type">{transaction.resultType}:</div>
        <div className="query-transaction__duration">
          {transaction.done ? formatLatency(transaction.latency) : <ElapsedTime />}
        </div>
      </div>
    );
  }
}

interface QueryTransactionsProps {
  transactions: QueryTransactionModel[];
}

export default class QueryTransactions extends PureComponent<QueryTransactionsProps> {
  render() {
    const { transactions } = this.props;
    return (
      <div className="query-transactions">
        {transactions.map((t, i) => <QueryTransaction key={`${t.query}:${t.resultType}`} transaction={t} />)}
      </div>
    );
  }
}
