import _ from 'lodash';
import React, { PureComponent } from 'react';

import * as rangeUtil from 'app/core/utils/rangeutil';
import { RawTimeRange, Switch } from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';

import {
  LogsDedupDescription,
  LogsDedupStrategy,
  LogsModel,
  dedupLogRows,
  filterLogLevels,
  LogLevel,
  LogsMetaKind,
} from 'app/core/logs_model';

import ToggleButtonGroup, { ToggleButton } from 'app/core/components/ToggleButtonGroup/ToggleButtonGroup';

import Graph from './Graph';
import { LogLabels } from './LogLabels';
import { LogRow } from './LogRow';

const PREVIEW_LIMIT = 100;

const graphOptions = {
  series: {
    stack: true,
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

function renderMetaItem(value: any, kind: LogsMetaKind) {
  if (kind === LogsMetaKind.LabelsMap) {
    return (
      <span className="logs-meta-item__labels">
        <LogLabels labels={value} plain />
      </span>
    );
  }
  return value;
}

interface Props {
  data?: LogsModel;
  width: number;
  exploreId: string;
  highlighterExpressions: string[];
  loading: boolean;
  range?: RawTimeRange;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  onChangeTime?: (range: RawTimeRange) => void;
  onClickLabel?: (label: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
}

interface State {
  dedup: LogsDedupStrategy;
  deferLogs: boolean;
  hiddenLogLevels: Set<LogLevel>;
  renderAll: boolean;
  showLabels: boolean | null; // Tristate: null means auto
  showLocalTime: boolean;
  showUtc: boolean;
}

export default class Logs extends PureComponent<Props, State> {
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
    const {
      data,
      exploreId,
      highlighterExpressions,
      loading = false,
      onClickLabel,
      range,
      scanning,
      scanRange,
      width,
    } = this.props;

    if (!data) {
      return null;
    }

    const { dedup, deferLogs, hiddenLogLevels, renderAll, showLocalTime, showUtc } = this.state;
    let { showLabels } = this.state;
    const hasData = data && data.rows && data.rows.length > 0;
    const showDuplicates = dedup !== LogsDedupStrategy.none;

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

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = () => processedRows;
    const timeSeries = data.series.map(series => new TimeSeries(series));

    return (
      <div className="logs-panel">
        <div className="logs-panel-graph">
          <Graph
            data={timeSeries}
            height={100}
            width={width}
            range={range}
            id={`explore-logs-graph-${exploreId}`}
            onChangeTime={this.props.onChangeTime}
            onToggleSeries={this.onToggleLogLevel}
            userOptions={graphOptions}
          />
        </div>
        <div className="logs-panel-options">
          <div className="logs-panel-controls">
            <Switch label="Timestamp" checked={showUtc} onChange={this.onChangeUtc} transparent />
            <Switch label="Local time" checked={showLocalTime} onChange={this.onChangeLocalTime} transparent />
            <Switch label="Labels" checked={showLabels} onChange={this.onChangeLabels} transparent />
            <ToggleButtonGroup label="Dedup" transparent={true}>
              {Object.keys(LogsDedupStrategy).map((dedupType, i) => (
                <ToggleButton
                  key={i}
                  value={dedupType}
                  onChange={this.onChangeDedup}
                  selected={dedup === dedupType}
                  tooltip={LogsDedupDescription[dedupType]}
                >
                  {dedupType}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        </div>

        {hasData &&
          meta && (
            <div className="logs-panel-meta">
              {meta.map(item => (
                <div className="logs-panel-meta__item" key={item.label}>
                  <span className="logs-panel-meta__label">{item.label}:</span>
                  <span className="logs-panel-meta__value">{renderMetaItem(item.value, item.kind)}</span>
                </div>
              ))}
            </div>
          )}

        <div className="logs-rows">
          {hasData &&
          !deferLogs && // Only inject highlighterExpression in the first set for performance reasons
            firstRows.map(row => (
              <LogRow
                key={row.key + row.duplicates}
                getRows={getRows}
                highlighterExpressions={highlighterExpressions}
                row={row}
                showDuplicates={showDuplicates}
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
              <LogRow
                key={row.key + row.duplicates}
                getRows={getRows}
                row={row}
                showDuplicates={showDuplicates}
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
            <div className="logs-panel-nodata">
              No logs found.
              <a className="link" onClick={this.onClickScan}>
                Scan for older logs
              </a>
            </div>
          )}

        {scanning && (
          <div className="logs-panel-nodata">
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
