import _ from 'lodash';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import * as rangeUtil from 'app/core/utils/rangeutil';
import { RawTimeRange } from 'app/types/series';
import {
  LogsDedupStrategy,
  LogsModel,
  dedupLogRows,
  filterLogLevels,
  LogLevel,
  LogsMetaKind,
  LogRow,
} from 'app/core/logs_model';
import { findHighlightChunksInText } from 'app/core/utils/text';
import { Switch } from 'app/core/components/Switch/Switch';

import Graph from './Graph';
import LogLabels from './LogLabels';

const PREVIEW_LIMIT = 100;

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

interface RowProps {
  allRows: LogRow[];
  row: LogRow;
  showLabels: boolean | null; // Tristate: null means auto
  showLocalTime: boolean;
  showUtc: boolean;
  onClickLabel?: (label: string, value: string) => void;
}

function Row({ allRows, onClickLabel, row, showLabels, showLocalTime, showUtc }: RowProps) {
  const needsHighlighter = row.searchWords && row.searchWords.length > 0;
  return (
    <>
      <div className={row.logLevel ? `logs-row-level logs-row-level-${row.logLevel}` : ''}>
        {row.duplicates > 0 && (
          <div className="logs-row-level__duplicates" title={`${row.duplicates} duplicates`}>
            {Array.apply(null, { length: row.duplicates }).map((bogus, index) => (
              <div className="logs-row-level__duplicate" key={`${index}`} />
            ))}
          </div>
        )}
      </div>
      {showUtc && (
        <div className="logs-row-time" title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>
          {row.timestamp}
        </div>
      )}
      {showLocalTime && (
        <div className="logs-row-time" title={`${row.timestamp} (${row.timeFromNow})`}>
          {row.timeLocal}
        </div>
      )}
      {showLabels && (
        <div className="logs-row-labels">
          <LogLabels allRows={allRows} labels={row.uniqueLabels} onClickLabel={onClickLabel} />
        </div>
      )}
      <div className="logs-row-message">
        {needsHighlighter ? (
          <Highlighter
            textToHighlight={row.entry}
            searchWords={row.searchWords}
            findChunks={findHighlightChunksInText}
            highlightClassName="logs-row-match-highlight"
          />
        ) : (
          row.entry
        )}
      </div>
    </>
  );
}

function renderMetaItem(value: any, kind: LogsMetaKind) {
  if (kind === LogsMetaKind.LabelsMap) {
    return (
      <span className="logs-meta-item__value-labels">
        <LogLabels labels={value} plain />
      </span>
    );
  }
  return value;
}

interface LogsProps {
  className?: string;
  data: LogsModel;
  loading: boolean;
  position: string;
  range?: RawTimeRange;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  onChangeTime?: (range: RawTimeRange) => void;
  onClickLabel?: (label: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
}

interface LogsState {
  dedup: LogsDedupStrategy;
  deferLogs: boolean;
  hiddenLogLevels: Set<LogLevel>;
  renderAll: boolean;
  showLabels: boolean | null; // Tristate: null means auto
  showLocalTime: boolean;
  showUtc: boolean;
}

export default class Logs extends PureComponent<LogsProps, LogsState> {
  deferLogsTimer: NodeJS.Timer;
  renderAllTimer: NodeJS.Timer;

  state = {
    dedup: LogsDedupStrategy.none,
    deferLogs: true,
    hiddenLogLevels: new Set(),
    renderAll: false,
    showLabels: null,
    showLocalTime: true,
    showUtc: false,
  };

  componentDidMount() {
    // Staged rendering
    if (this.state.deferLogs) {
      const { data } = this.props;
      const rowCount = data && data.rows ? data.rows.length : 0;
      // Render all right away if not too far over the limit
      const renderAll = rowCount <= PREVIEW_LIMIT * 2;
      this.deferLogsTimer = setTimeout(() => this.setState({ deferLogs: false, renderAll }), rowCount);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // Staged rendering
    if (prevState.deferLogs && !this.state.deferLogs && !this.state.renderAll) {
      this.renderAllTimer = setTimeout(() => this.setState({ renderAll: true }), 2000);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.deferLogsTimer);
    clearTimeout(this.renderAllTimer);
  }

  onChangeDedup = (dedup: LogsDedupStrategy) => {
    this.setState(prevState => {
      if (prevState.dedup === dedup) {
        return { dedup: LogsDedupStrategy.none };
      }
      return { dedup };
    });
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

  onToggleLogLevel = (rawLevel: string, hiddenRawLevels: Set<string>) => {
    const hiddenLogLevels: Set<LogLevel> = new Set(Array.from(hiddenRawLevels).map(level => LogLevel[level]));
    this.setState({ hiddenLogLevels });
  };

  onClickScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    this.props.onStartScanning();
  };

  onClickStopScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    this.props.onStopScanning();
  };

  render() {
    const { className = '', data, loading = false, onClickLabel, position, range, scanning, scanRange } = this.props;
    const { dedup, deferLogs, hiddenLogLevels, renderAll, showLocalTime, showUtc } = this.state;
    let { showLabels } = this.state;
    const hasData = data && data.rows && data.rows.length > 0;

    // Filtering
    const filteredData = filterLogLevels(data, hiddenLogLevels);
    const dedupedData = dedupLogRows(filteredData, dedup);
    const dedupCount = dedupedData.rows.reduce((sum, row) => sum + row.duplicates, 0);
    const meta = [...data.meta];
    if (dedup !== LogsDedupStrategy.none) {
      meta.push({
        label: 'Dedup count',
        value: dedupCount,
        kind: LogsMetaKind.Number,
      });
    }

    // Staged rendering
    const processedRows = dedupedData.rows;
    const firstRows = processedRows.slice(0, PREVIEW_LIMIT);
    const lastRows = processedRows.slice(PREVIEW_LIMIT);

    // Check for labels
    if (showLabels === null) {
      if (hasData) {
        showLabels = data.rows.some(row => _.size(row.uniqueLabels) > 0);
      } else {
        showLabels = true;
      }
    }

    // Grid options
    const cssColumnSizes = ['3px']; // Log-level indicator line
    if (showUtc) {
      cssColumnSizes.push('minmax(100px, max-content)');
    }
    if (showLocalTime) {
      cssColumnSizes.push('minmax(100px, max-content)');
    }
    if (showLabels) {
      cssColumnSizes.push('fit-content(20%)');
    }
    cssColumnSizes.push('1fr');
    const logEntriesStyle = {
      gridTemplateColumns: cssColumnSizes.join(' '),
    };

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

    return (
      <div className={`${className} logs`}>
        <div className="logs-graph">
          <Graph
            data={data.series}
            height="100px"
            range={range}
            id={`explore-logs-graph-${position}`}
            onChangeTime={this.props.onChangeTime}
            onToggleSeries={this.onToggleLogLevel}
            userOptions={graphOptions}
          />
        </div>

        <div className="logs-options">
          <div className="logs-controls">
            <Switch label="Timestamp" checked={showUtc} onChange={this.onChangeUtc} small />
            <Switch label="Local time" checked={showLocalTime} onChange={this.onChangeLocalTime} small />
            <Switch label="Labels" checked={showLabels} onChange={this.onChangeLabels} small />
            <Switch
              label="Dedup: off"
              checked={dedup === LogsDedupStrategy.none}
              onChange={() => this.onChangeDedup(LogsDedupStrategy.none)}
              small
            />
            <Switch
              label="Dedup: exact"
              checked={dedup === LogsDedupStrategy.exact}
              onChange={() => this.onChangeDedup(LogsDedupStrategy.exact)}
              small
            />
            <Switch
              label="Dedup: numbers"
              checked={dedup === LogsDedupStrategy.numbers}
              onChange={() => this.onChangeDedup(LogsDedupStrategy.numbers)}
              small
            />
            <Switch
              label="Dedup: signature"
              checked={dedup === LogsDedupStrategy.signature}
              onChange={() => this.onChangeDedup(LogsDedupStrategy.signature)}
              small
            />
            {hasData &&
              meta && (
                <div className="logs-meta">
                  {meta.map(item => (
                    <div className="logs-meta-item" key={item.label}>
                      <span className="logs-meta-item__label">{item.label}:</span>
                      <span className="logs-meta-item__value">{renderMetaItem(item.value, item.kind)}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        <div className="logs-entries" style={logEntriesStyle}>
          {hasData &&
            !deferLogs &&
            firstRows.map(row => (
              <Row
                key={row.key + row.duplicates}
                allRows={processedRows}
                row={row}
                showLabels={showLabels}
                showLocalTime={showLocalTime}
                showUtc={showUtc}
                onClickLabel={onClickLabel}
              />
            ))}
          {hasData &&
            !deferLogs &&
            renderAll &&
            lastRows.map(row => (
              <Row
                key={row.key + row.duplicates}
                allRows={processedRows}
                row={row}
                showLabels={showLabels}
                showLocalTime={showLocalTime}
                showUtc={showUtc}
                onClickLabel={onClickLabel}
              />
            ))}
          {hasData && deferLogs && <span>Rendering {dedupedData.rows.length} rows...</span>}
        </div>
        {!loading &&
          !hasData &&
          !scanning && (
            <div className="logs-nodata">
              No logs found.
              <a className="link" onClick={this.onClickScan}>
                Scan for older logs
              </a>
            </div>
          )}

        {scanning && (
          <div className="logs-nodata">
            <span>{scanText}</span>
            <a className="link" onClick={this.onClickStopScan}>
              Stop scan
            </a>
          </div>
        )}
      </div>
    );
  }
}
