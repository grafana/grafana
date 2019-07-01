import _ from 'lodash';
import React, { PureComponent } from 'react';

import * as rangeUtil from '@grafana/ui/src/utils/rangeutil';
import {
  RawTimeRange,
  Switch,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  LogsMetaKind,
  LogsModel,
  LogsDedupStrategy,
  LogRowModel,
} from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';

import ToggleButtonGroup, { ToggleButton } from 'app/core/components/ToggleButtonGroup/ToggleButtonGroup';

import Graph from './Graph';
import { LogLabels } from './LogLabels';
import { LogRow } from './LogRow';
import { LogsDedupDescription } from 'app/core/logs_model';

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
  dedupedData?: LogsModel;
  width: number;
  exploreId: string;
  highlighterExpressions: string[];
  loading: boolean;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  dedupStrategy: LogsDedupStrategy;
  hiddenLogLevels: Set<LogLevel>;
  onChangeTime?: (range: AbsoluteTimeRange) => void;
  onClickLabel?: (label: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  onDedupStrategyChange: (dedupStrategy: LogsDedupStrategy) => void;
  onToggleLogLevel: (hiddenLogLevels: LogLevel[]) => void;
  getRowContext?: (row: LogRowModel, options?: any) => Promise<any>;
}

interface State {
  deferLogs: boolean;
  renderAll: boolean;
  showLabels: boolean;
  showTime: boolean;
}

export default class Logs extends PureComponent<Props, State> {
  deferLogsTimer: NodeJS.Timer;
  renderAllTimer: NodeJS.Timer;

  state = {
    deferLogs: true,
    renderAll: false,
    showLabels: false,
    showTime: true,
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

  componentDidUpdate(prevProps: Props, prevState: State) {
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
    const { onDedupStrategyChange } = this.props;
    if (this.props.dedupStrategy === dedup) {
      return onDedupStrategyChange(LogsDedupStrategy.none);
    }
    return onDedupStrategyChange(dedup);
  };

  onChangeLabels = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    this.setState({
      showLabels: target.checked,
    });
  };

  onChangeTime = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    this.setState({
      showTime: target.checked,
    });
  };

  onToggleLogLevel = (rawLevel: string, hiddenRawLevels: string[]) => {
    const hiddenLogLevels: LogLevel[] = hiddenRawLevels.map(level => LogLevel[level]);
    this.props.onToggleLogLevel(hiddenLogLevels);
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
      absoluteRange,
      timeZone,
      scanning,
      scanRange,
      width,
      dedupedData,
    } = this.props;

    if (!data) {
      return null;
    }

    const { deferLogs, renderAll, showLabels, showTime } = this.state;
    const { dedupStrategy } = this.props;
    const hasData = data && data.rows && data.rows.length > 0;
    const hasLabel = hasData && dedupedData.hasUniqueLabels;
    const dedupCount = dedupedData.rows.reduce((sum, row) => sum + row.duplicates, 0);
    const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;
    const meta = data.meta ? [...data.meta] : [];

    if (dedupStrategy !== LogsDedupStrategy.none) {
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
    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = () => processedRows;
    const timeSeries = data.series
      ? data.series.map(series => new TimeSeries(series))
      : [new TimeSeries({ datapoints: [] })];

    return (
      <div className="logs-panel">
        <div className="logs-panel-graph">
          <Graph
            data={timeSeries}
            height={100}
            width={width}
            range={absoluteRange}
            timeZone={timeZone}
            id={`explore-logs-graph-${exploreId}`}
            onChangeTime={this.props.onChangeTime}
            onToggleSeries={this.onToggleLogLevel}
            userOptions={graphOptions}
          />
        </div>
        <div className="logs-panel-options">
          <div className="logs-panel-controls">
            <Switch label="Time" checked={showTime} onChange={this.onChangeTime} transparent />
            <Switch label="Labels" checked={showLabels} onChange={this.onChangeLabels} transparent />
            <ToggleButtonGroup label="Dedup" transparent={true}>
              {Object.keys(LogsDedupStrategy).map((dedupType, i) => (
                <ToggleButton
                  key={i}
                  value={dedupType}
                  onChange={this.onChangeDedup}
                  selected={dedupStrategy === dedupType}
                  tooltip={LogsDedupDescription[dedupType]}
                >
                  {dedupType}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        </div>

        {hasData && meta && (
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
            firstRows.map((row, index) => (
              <LogRow
                key={index}
                getRows={getRows}
                getRowContext={this.props.getRowContext}
                highlighterExpressions={highlighterExpressions}
                row={row}
                showDuplicates={showDuplicates}
                showLabels={showLabels && hasLabel}
                showTime={showTime}
                timeZone={timeZone}
                onClickLabel={onClickLabel}
              />
            ))}
          {hasData &&
            !deferLogs &&
            renderAll &&
            lastRows.map((row, index) => (
              <LogRow
                key={PREVIEW_LIMIT + index}
                getRows={getRows}
                getRowContext={this.props.getRowContext}
                row={row}
                showDuplicates={showDuplicates}
                showLabels={showLabels && hasLabel}
                showTime={showTime}
                timeZone={timeZone}
                onClickLabel={onClickLabel}
              />
            ))}
          {hasData && deferLogs && <span>Rendering {dedupedData.rows.length} rows...</span>}
        </div>
        {!loading && !hasData && !scanning && (
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
