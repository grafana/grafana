import React, { Fragment, PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import { LogsModel } from 'app/core/logs_model';
import { findHighlightChunksInText } from 'app/core/utils/text';

interface LogsProps {
  className?: string;
  data: LogsModel;
  loading: boolean;
}

const EXAMPLE_QUERY = '{job="default/prometheus"}';

export default class Logs extends PureComponent<LogsProps, {}> {
  render() {
    const { className = '', data } = this.props;
    const hasData = data && data.rows && data.rows.length > 0;
    return (
      <div className={`${className} logs`}>
        {hasData ? (
          <div className="logs-entries panel-container">
            {data.rows.map(row => (
              <Fragment key={row.key}>
                <div className={row.logLevel ? `logs-row-level logs-row-level-${row.logLevel}` : ''} />
                <div title={`${row.timestamp} (${row.timeFromNow})`}>{row.timeLocal}</div>
                <div>
                  <Highlighter
                    textToHighlight={row.entry}
                    searchWords={row.searchWords}
                    findChunks={findHighlightChunksInText}
                    highlightClassName="logs-row-match-highlight"
                  />
                </div>
              </Fragment>
            ))}
          </div>
        ) : null}
        {!hasData ? (
          <div className="panel-container">
            Enter a query like <code>{EXAMPLE_QUERY}</code>
          </div>
        ) : null}
      </div>
    );
  }
}
