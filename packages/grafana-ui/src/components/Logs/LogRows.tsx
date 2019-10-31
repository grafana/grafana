import React, { PureComponent } from 'react';
import { cx } from 'emotion';
import { TimeZone, LogsDedupStrategy, LogRowModel } from '@grafana/data';

import { LogRow } from './LogRow';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import memoizeOne from 'memoize-one';

export const PREVIEW_LIMIT = 100;
export const RENDER_LIMIT = 500;

export interface Props extends Themeable {
  logRows?: LogRowModel[];
  deduplicatedRows?: LogRowModel[];
  hasUniqueLabels: boolean;
  dedupStrategy: LogsDedupStrategy;
  highlighterExpressions: string[];
  showTime: boolean;
  showLabels: boolean;
  timeZone: TimeZone;
  onClickLabel?: (label: string, value: string) => void;
  getRowContext?: (row: LogRowModel, options?: any) => Promise<any>;
  rowLimit?: number;
  previewLimit?: number;
}

interface State {
  renderAll: boolean;
}

class UnThemedLogRows extends PureComponent<Props, State> {
  renderAllTimer: number | null = null;

  static defaultProps = {
    previewLimit: PREVIEW_LIMIT,
    rowLimit: RENDER_LIMIT,
  };

  state: State = {
    renderAll: false,
  };

  componentDidMount() {
    // Staged rendering
    const { logRows, previewLimit } = this.props;
    const rowCount = logRows ? logRows.length : 0;
    // Render all right away if not too far over the limit
    const renderAll = rowCount <= previewLimit! * 2;
    if (renderAll) {
      this.setState({ renderAll });
    } else {
      this.renderAllTimer = window.setTimeout(() => this.setState({ renderAll: true }), 2000);
    }
  }

  componentWillUnmount() {
    if (this.renderAllTimer) {
      clearTimeout(this.renderAllTimer);
    }
  }

  makeGetRows = memoizeOne((processedRows: LogRowModel[]) => {
    return () => processedRows;
  });

  render() {
    const {
      dedupStrategy,
      showTime,
      logRows,
      deduplicatedRows,
      highlighterExpressions,
      showLabels,
      timeZone,
      onClickLabel,
      rowLimit,
      theme,
      previewLimit,
      hasUniqueLabels,
    } = this.props;
    const { renderAll } = this.state;
    const dedupedRows = deduplicatedRows ? deduplicatedRows : logRows;
    const hasData = logRows && logRows.length > 0;
    const hasLabel = hasData && dedupedRows && hasUniqueLabels ? true : false;
    const dedupCount = dedupedRows
      ? dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
      : 0;
    const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;

    // Staged rendering
    const processedRows = dedupedRows ? dedupedRows : [];
    const firstRows = processedRows.slice(0, previewLimit!);
    const rowCount = Math.min(processedRows.length, rowLimit!);
    const lastRows = processedRows.slice(previewLimit!, rowCount);

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = this.makeGetRows(processedRows);
    const getRowContext = this.props.getRowContext ? this.props.getRowContext : () => Promise.resolve([]);
    const { logsRows } = getLogRowStyles(theme);

    return (
      <div className={cx([logsRows])}>
        {hasData &&
          firstRows.map((row, index) => (
            <LogRow
              key={row.uid}
              getRows={getRows}
              getRowContext={getRowContext}
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
          renderAll &&
          lastRows.map((row, index) => (
            <LogRow
              key={row.uid}
              getRows={getRows}
              getRowContext={getRowContext}
              row={row}
              showDuplicates={showDuplicates}
              showLabels={showLabels && hasLabel}
              showTime={showTime}
              timeZone={timeZone}
              onClickLabel={onClickLabel}
            />
          ))}
        {hasData && !renderAll && <span>Rendering {rowCount - previewLimit!} rows...</span>}
      </div>
    );
  }
}

export const LogRows = withTheme(UnThemedLogRows);
LogRows.displayName = 'LogsRows';
