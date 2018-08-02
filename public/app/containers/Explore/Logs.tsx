import React, { Fragment, PureComponent } from 'react';

import { LogsModel, LogRow } from 'app/core/logs_model';

interface LogsProps {
  className?: string;
  data: LogsModel;
}

const EXAMPLE_QUERY = '{job="default/prometheus"}';

const Entry: React.SFC<LogRow> = props => {
  const { entry, searchMatches } = props;
  if (searchMatches && searchMatches.length > 0) {
    let lastMatchEnd = 0;
    const spans = searchMatches.reduce((acc, match, i) => {
      // Insert non-match
      if (match.start !== lastMatchEnd) {
        acc.push(<>{entry.slice(lastMatchEnd, match.start)}</>);
      }
      // Match
      acc.push(
        <span className="logs-row-match-highlight" title={`Matching expression: ${match.text}`}>
          {entry.substr(match.start, match.length)}
        </span>
      );
      lastMatchEnd = match.start + match.length;
      // Non-matching end
      if (i === searchMatches.length - 1) {
        acc.push(<>{entry.slice(lastMatchEnd)}</>);
      }
      return acc;
    }, []);
    return <>{spans}</>;
  }
  return <>{props.entry}</>;
};

export default class Logs extends PureComponent<LogsProps, any> {
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
                  <Entry {...row} />
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
