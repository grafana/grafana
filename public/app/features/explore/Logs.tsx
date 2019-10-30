import React, { PureComponent } from 'react';

import {
  rangeUtil,
  RawTimeRange,
  LogLevel,
  TimeZone,
  AbsoluteTimeRange,
  LogsMetaKind,
  LogsDedupStrategy,
  LogRowModel,
  LogsDedupDescription,
  LogsMetaItem,
  GraphSeriesXY,
} from '@grafana/data';
import { Switch, LogLabels, ToggleButtonGroup, ToggleButton, LogRows } from '@grafana/ui';

import { ExploreGraphPanel } from './ExploreGraphPanel';

function renderMetaItem(value: any, kind: LogsMetaKind) {
  if (kind === LogsMetaKind.LabelsMap) {
    return (
      <span className="logs-meta-item__labels">
        <LogLabels labels={value} plain getRows={() => []} />
      </span>
    );
  }
  return value;
}

interface Props {
  logRows?: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSeries?: GraphSeriesXY[];
  dedupedRows?: LogRowModel[];
  hasUniqueLabels: boolean;

  width: number;
  highlighterExpressions: string[];
  loading: boolean;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  dedupStrategy: LogsDedupStrategy;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  onClickLabel?: (label: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  onDedupStrategyChange: (dedupStrategy: LogsDedupStrategy) => void;
  onToggleLogLevel: (hiddenLogLevels: LogLevel[]) => void;
  getRowContext?: (row: LogRowModel, options?: any) => Promise<any>;
}

interface State {
  showLabels: boolean;
  showTime: boolean;
}

export class Logs extends PureComponent<Props, State> {
  state = {
    showLabels: false,
    showTime: true,
  };

  onChangeDedup = (dedup: LogsDedupStrategy) => {
    const { onDedupStrategyChange } = this.props;
    if (this.props.dedupStrategy === dedup) {
      return onDedupStrategyChange(LogsDedupStrategy.none);
    }
    return onDedupStrategyChange(dedup);
  };

  onChangeLabels = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    if (target) {
      this.setState({
        showLabels: target.checked,
      });
    }
  };

  onChangeTime = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    if (target) {
      this.setState({
        showTime: target.checked,
      });
    }
  };

  onToggleLogLevel = (hiddenRawLevels: string[]) => {
    const hiddenLogLevels: LogLevel[] = hiddenRawLevels.map(level => LogLevel[level as LogLevel]);
    this.props.onToggleLogLevel(hiddenLogLevels);
  };

  onClickScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (this.props.onStartScanning) {
      this.props.onStartScanning();
    }
  };

  onClickStopScan = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (this.props.onStopScanning) {
      this.props.onStopScanning();
    }
  };

  render() {
    const {
      logRows,
      logsMeta,
      logsSeries,
      highlighterExpressions,
      loading = false,
      onClickLabel,
      timeZone,
      scanning,
      scanRange,
      width,
      dedupedRows,
      absoluteRange,
      onChangeTime,
      hasUniqueLabels,
    } = this.props;

    if (!logRows) {
      return null;
    }

    const { showLabels, showTime } = this.state;
    const { dedupStrategy } = this.props;
    const hasData = logRows && logRows.length > 0;
    const dedupCount = dedupedRows
      ? dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
      : 0;
    const meta = logsMeta ? [...logsMeta] : [];

    if (dedupStrategy !== LogsDedupStrategy.none) {
      meta.push({
        label: 'Dedup count',
        value: dedupCount,
        kind: LogsMetaKind.Number,
      });
    }

    const scanText = scanRange ? `Scanning ${rangeUtil.describeTimeRange(scanRange)}` : 'Scanning...';
    const series = logsSeries ? logsSeries : [];

    return (
      <div className="logs-panel">
        <div className="logs-panel-graph">
          <ExploreGraphPanel
            series={series}
            width={width}
            onHiddenSeriesChanged={this.onToggleLogLevel}
            loading={loading}
            absoluteRange={absoluteRange}
            isStacked={true}
            showPanel={false}
            showingGraph={true}
            showingTable={true}
            timeZone={timeZone}
            showBars={true}
            showLines={false}
            onUpdateTimeRange={onChangeTime}
          />
        </div>
        <div className="logs-panel-options">
          <div className="logs-panel-controls">
            <Switch label="Time" checked={showTime} onChange={this.onChangeTime} transparent />
            <Switch label="Labels" checked={showLabels} onChange={this.onChangeLabels} transparent />
            <ToggleButtonGroup label="Dedup" transparent={true}>
              {Object.keys(LogsDedupStrategy).map((dedupType: string, i) => (
                <ToggleButton
                  key={i}
                  value={dedupType}
                  onChange={this.onChangeDedup}
                  selected={dedupStrategy === dedupType}
                  // @ts-ignore
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

        <LogRows
          hasUniqueLabels={hasUniqueLabels}
          logRows={logRows}
          deduplicatedRows={dedupedRows}
          dedupStrategy={dedupStrategy}
          getRowContext={this.props.getRowContext}
          highlighterExpressions={highlighterExpressions}
          onClickLabel={onClickLabel}
          rowLimit={logRows ? logRows.length : undefined}
          showLabels={showLabels}
          showTime={showTime}
          timeZone={timeZone}
        />

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
