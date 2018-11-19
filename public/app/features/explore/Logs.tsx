import React, { Fragment, PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import { RawTimeRange } from 'app/types/series';
import { LogsModel } from 'app/core/logs_model';
import { findHighlightChunksInText } from 'app/core/utils/text';
import { Switch } from 'app/core/components/Switch/Switch';

import Graph from './Graph';

const graphOptions = {
  series: {
    bars: {
      show: true,
      lineWidth: 5,
      // barWidth: 10,
    },
    // stack: true,
  },
  yaxis: {
    tickDecimals: 0,
  },
};

interface LogsProps {
  className?: string;
  data: LogsModel;
  loading: boolean;
  position: string;
  range?: RawTimeRange;
  onChangeTime?: (range: RawTimeRange) => void;
}

interface LogsState {
  showLabels: boolean;
  showLocalTime: boolean;
  showUtc: boolean;
}

export default class Logs extends PureComponent<LogsProps, LogsState> {
  state = {
    showLabels: true,
    showLocalTime: true,
    showUtc: false,
  };

  onChangeLabels = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    this.setState({
      showLabels: target.checked,
    });
  };

  onChangeLocalTime = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    this.setState({
      showLocalTime: target.checked,
    });
  };

  onChangeUtc = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    this.setState({
      showUtc: target.checked,
    });
  };

  render() {
    const { className = '', data, loading = false, position, range } = this.props;
    const { showLabels, showLocalTime, showUtc } = this.state;
    const hasData = data && data.rows && data.rows.length > 0;
    const cssColumnSizes = ['4px'];
    if (showUtc) {
      cssColumnSizes.push('minmax(100px, max-content)');
    }
    if (showLocalTime) {
      cssColumnSizes.push('minmax(100px, max-content)');
    }
    if (showLabels) {
      cssColumnSizes.push('minmax(100px, 25%)');
    }
    cssColumnSizes.push('1fr');
    const logEntriesStyle = {
      gridTemplateColumns: cssColumnSizes.join(' '),
    };

    return (
      <div className={`${className} logs`}>
        <div className="logs-graph">
          <Graph
            data={data.series}
            height="100px"
            range={range}
            id={`explore-logs-graph-${position}`}
            onChangeTime={this.props.onChangeTime}
            userOptions={graphOptions}
          />
        </div>

        <div className="logs-options">
          <div className="logs-controls">
            <Switch label="Timestamp" checked={showUtc} onChange={this.onChangeUtc} small />
            <Switch label="Local time" checked={showLocalTime} onChange={this.onChangeLocalTime} small />
            <Switch label="Labels" checked={showLabels} onChange={this.onChangeLabels} small />
            {hasData &&
              data.meta && (
                <div className="logs-meta">
                  {data.meta.map(item => (
                    <div className="logs-meta-item" key={item.label}>
                      <span className="logs-meta-item__label">{item.label}:</span>
                      <span className="logs-meta-item__value">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        <div className="logs-entries" style={logEntriesStyle}>
          {hasData &&
            data.rows.map(row => (
              <Fragment key={row.key}>
                <div className={row.logLevel ? `logs-row-level logs-row-level-${row.logLevel}` : ''} />
                {showUtc && <div title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>{row.timestamp}</div>}
                {showLocalTime && <div title={`${row.timestamp} (${row.timeFromNow})`}>{row.timeLocal}</div>}
                {showLabels && (
                  <div className="max-width" title={row.labels}>
                    {row.labels}
                  </div>
                )}
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
    );
  }
}
