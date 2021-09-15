import React, { PureComponent } from 'react';

import { ElapsedTime } from './ElapsedTime';
import { PanelData, LoadingState } from '@grafana/data';

function formatLatency(value: number) {
  return `${(value / 1000).toFixed(1)}s`;
}

interface QueryStatusItemProps {
  queryResponse: PanelData;
  latency: number;
}

class QueryStatusItem extends PureComponent<QueryStatusItemProps> {
  render() {
    const { queryResponse, latency } = this.props;
    const className =
      queryResponse.state === LoadingState.Done || LoadingState.Error
        ? 'query-transaction'
        : 'query-transaction query-transaction--loading';
    return (
      <div className={className}>
        {/* <div className="query-transaction__type">{transaction.resultType}:</div> */}
        <div className="query-transaction__duration">
          {queryResponse.state === LoadingState.Done || LoadingState.Error ? formatLatency(latency) : <ElapsedTime />}
        </div>
      </div>
    );
  }
}

interface QueryStatusProps {
  queryResponse: PanelData;
  latency: number;
}

export default class QueryStatus extends PureComponent<QueryStatusProps> {
  render() {
    const { queryResponse, latency } = this.props;

    if (queryResponse.state === LoadingState.NotStarted) {
      return null;
    }

    return (
      <div className="query-transactions">
        <QueryStatusItem queryResponse={queryResponse} latency={latency} />
      </div>
    );
  }
}
