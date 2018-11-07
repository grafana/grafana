import React, { Fragment, PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import { LogsModel } from 'app/core/logs_model';
import { findHighlightChunksInText } from 'app/core/utils/text';

interface LogsProps {
  className?: string;
  data: LogsModel;
  loading: boolean;
}

export default class Logs extends PureComponent<LogsProps, {}> {
  render() {
    const { className = '', data, loading = false } = this.props;
    const hasData = data && data.rows && data.rows.length > 0;
    return (
      <div className={`${className} logs`}>
        <div className="panel-container">
          {loading && <div className="explore-panel__loader" />}
          <div className="logs-entries">
            {hasData &&
              data.rows.map(row => (
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
          {!loading && !hasData && 'No data was returned.'}
        </div>
      </div>
    );
  }
}
