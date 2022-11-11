import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';

import { TimeZone, LogsDedupStrategy, LogRowModel, Field, LinkModel, LogsSortOrder, sortLogRows } from '@grafana/data';

import { withTheme2 } from '../../themes/index';
import { Themeable2 } from '../../types/theme';

import { LogRow } from './LogRow';
import { RowContextOptions } from './LogRowContextProvider';
import { getLogRowStyles } from './getLogRowStyles';

/** @deprecated will be removed in the next major version */
export const PREVIEW_LIMIT = 100;

/** @deprecated will be removed in the next major version */
export interface Props extends Themeable2 {
  logRows?: LogRowModel[];
  deduplicatedRows?: LogRowModel[];
  dedupStrategy: LogsDedupStrategy;
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  timeZone: TimeZone;
  enableLogDetails: boolean;
  logsSortOrder?: LogsSortOrder | null;
  previewLimit?: number;
  forceEscape?: boolean;
  showDetectedFields?: string[];
  showContextToggle?: (row?: LogRowModel) => boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  getRowContext?: (row: LogRowModel, options?: RowContextOptions) => Promise<any>;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  onClickShowDetectedField?: (key: string) => void;
  onClickHideDetectedField?: (key: string) => void;
  onLogRowHover?: (row?: LogRowModel) => void;
}

interface State {
  renderAll: boolean;
}

class UnThemedLogRows extends PureComponent<Props, State> {
  renderAllTimer: number | null = null;

  static defaultProps = {
    previewLimit: PREVIEW_LIMIT,
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

  makeGetRows = memoizeOne((orderedRows: LogRowModel[]) => {
    return () => orderedRows;
  });

  sortLogs = memoizeOne((logRows: LogRowModel[], logsSortOrder: LogsSortOrder): LogRowModel[] =>
    sortLogRows(logRows, logsSortOrder)
  );

  render() {
    const {
      dedupStrategy,
      showContextToggle,
      showLabels,
      showTime,
      wrapLogMessage,
      prettifyLogMessage,
      logRows,
      deduplicatedRows,
      timeZone,
      onClickFilterLabel,
      onClickFilterOutLabel,
      theme,
      enableLogDetails,
      previewLimit,
      getFieldLinks,
      logsSortOrder,
      showDetectedFields,
      onClickShowDetectedField,
      onClickHideDetectedField,
      forceEscape,
      onLogRowHover,
    } = this.props;
    const { renderAll } = this.state;
    const { logsRowsTable } = getLogRowStyles(theme);
    const dedupedRows = deduplicatedRows ? deduplicatedRows : logRows;
    const hasData = logRows && logRows.length > 0;
    const dedupCount = dedupedRows
      ? dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
      : 0;
    const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;
    // Staged rendering
    const processedRows = dedupedRows ? dedupedRows : [];
    const orderedRows = logsSortOrder ? this.sortLogs(processedRows, logsSortOrder) : processedRows;
    const firstRows = orderedRows.slice(0, previewLimit!);
    const lastRows = orderedRows.slice(previewLimit!, orderedRows.length);

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = this.makeGetRows(orderedRows);
    const getRowContext = this.props.getRowContext ? this.props.getRowContext : () => Promise.resolve([]);

    return (
      <table className={logsRowsTable}>
        <tbody>
          {hasData &&
            firstRows.map((row, index) => (
              <LogRow
                key={row.uid}
                getRows={getRows}
                getRowContext={getRowContext}
                row={row}
                showContextToggle={showContextToggle}
                showDuplicates={showDuplicates}
                showLabels={showLabels}
                showTime={showTime}
                showDetectedFields={showDetectedFields}
                wrapLogMessage={wrapLogMessage}
                prettifyLogMessage={prettifyLogMessage}
                timeZone={timeZone}
                enableLogDetails={enableLogDetails}
                onClickFilterLabel={onClickFilterLabel}
                onClickFilterOutLabel={onClickFilterOutLabel}
                onClickShowDetectedField={onClickShowDetectedField}
                onClickHideDetectedField={onClickHideDetectedField}
                getFieldLinks={getFieldLinks}
                logsSortOrder={logsSortOrder}
                forceEscape={forceEscape}
                onLogRowHover={onLogRowHover}
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
                showContextToggle={showContextToggle}
                showDuplicates={showDuplicates}
                showLabels={showLabels}
                showTime={showTime}
                showDetectedFields={showDetectedFields}
                wrapLogMessage={wrapLogMessage}
                prettifyLogMessage={prettifyLogMessage}
                timeZone={timeZone}
                enableLogDetails={enableLogDetails}
                onClickFilterLabel={onClickFilterLabel}
                onClickFilterOutLabel={onClickFilterOutLabel}
                onClickShowDetectedField={onClickShowDetectedField}
                onClickHideDetectedField={onClickHideDetectedField}
                getFieldLinks={getFieldLinks}
                logsSortOrder={logsSortOrder}
                forceEscape={forceEscape}
                onLogRowHover={onLogRowHover}
              />
            ))}
          {hasData && !renderAll && (
            <tr>
              <td colSpan={5}>Rendering {orderedRows.length - previewLimit!} rows...</td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }
}

/** @deprecated will be removed in the next major version */
export const LogRows = withTheme2(UnThemedLogRows);
LogRows.displayName = 'LogsRows';
