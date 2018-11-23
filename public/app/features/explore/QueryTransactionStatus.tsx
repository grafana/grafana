import React, { PureComponent } from 'react';

import { QueryTransaction } from 'app/types/explore';
import ElapsedTime from './ElapsedTime';

function formatLatency(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

interface QueryTransactionStatusItemProps {
  transaction: QueryTransaction;
}

class QueryTransactionStatusItem extends PureComponent<QueryTransactionStatusItemProps> {
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

interface QueryTransactionStatusProps {
  transactions: QueryTransaction[];
}

export default class QueryTransactionStatus extends PureComponent<QueryTransactionStatusProps> {
  render() {
    const { transactions } = this.props;
    return (
      <div className="query-transactions">
        {transactions.map((t, i) => (
          <QueryTransactionStatusItem key={`${t.rowIndex}:${t.resultType}`} transaction={t} />
        ))}
      </div>
    );
  }
}
