import React, { PureComponent } from 'react';

import {
  rangeUtil,
  RawTimeRange,
  TimeZone,
  AbsoluteTimeRange,
  LogsMetaKind,
  LogsDedupStrategy,
  LogRowModel,
  LogsMetaItem,
  GraphSeriesXY,
  LinkModel,
  Field,
} from '@grafana/data';

import { LogLabels, LogRows } from '@grafana/ui';
import { MetaInfoText } from './MetaInfoText';

function renderMetaItem(value: any, kind: LogsMetaKind) {
  if (kind === LogsMetaKind.LabelsMap) {
    return (
      <span className="logs-meta-item__labels">
        <LogLabels labels={value} />
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
  visibleRange?: AbsoluteTimeRange;

  width: number;
  highlighterExpressions?: string[];
  loading: boolean;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  dedupStrategy: LogsDedupStrategy;

  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;

  showContextToggle?: (row?: LogRowModel) => boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  onStartScanning?: () => void;
  onStopScanning?: () => void;
  getRowContext?: (row: LogRowModel, options?: any) => Promise<any>;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

export class Logs extends PureComponent<Props> {
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
      highlighterExpressions,
      loading = false,
      onClickFilterLabel,
      onClickFilterOutLabel,
      timeZone,
      scanning,
      scanRange,
      showContextToggle,
      dedupedRows,
      dedupStrategy,
      getFieldLinks,
      showLabels,
      showTime,
      wrapLogMessage,
    } = this.props;

    if (!logRows) {
      return null;
    }

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

    return (
      <>
        {hasData && meta && (
          <MetaInfoText
            metaItems={meta.map(item => {
              return {
                label: item.label,
                value: renderMetaItem(item.value, item.kind),
              };
            })}
          />
        )}

        <LogRows
          logRows={logRows}
          deduplicatedRows={dedupedRows}
          dedupStrategy={dedupStrategy}
          getRowContext={this.props.getRowContext}
          highlighterExpressions={highlighterExpressions}
          rowLimit={logRows ? logRows.length : undefined}
          onClickFilterLabel={onClickFilterLabel}
          onClickFilterOutLabel={onClickFilterOutLabel}
          showContextToggle={showContextToggle}
          showLabels={showLabels}
          showTime={showTime}
          wrapLogMessage={wrapLogMessage}
          timeZone={timeZone}
          getFieldLinks={getFieldLinks}
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
      </>
    );
  }
}
