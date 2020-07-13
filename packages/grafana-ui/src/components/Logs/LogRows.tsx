import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { TimeZone, LogsDedupStrategy, LogRowModel, Field, LinkModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogRow } from './LogRow';
import { RowContextOptions } from './LogRowContextProvider';

export const PREVIEW_LIMIT = 100;
export const RENDER_LIMIT = 500;

export interface Props extends Themeable {
  logRows?: LogRowModel[];
  deduplicatedRows?: LogRowModel[];
  dedupStrategy: LogsDedupStrategy;
  highlighterExpressions?: string[];
  showContextToggle?: (row?: LogRowModel) => boolean;
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  timeZone: TimeZone;
  rowLimit?: number;
  allowDetails?: boolean;
  previewLimit?: number;
  // Passed to fix problems with inactive scrolling in Logs Panel
  // Can be removed when we unify scrolling for Panel and Explore
  disableCustomHorizontalScroll?: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  getRowContext?: (row: LogRowModel, options?: RowContextOptions) => Promise<any>;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
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
      showContextToggle,
      showLabels,
      showTime,
      wrapLogMessage,
      logRows,
      deduplicatedRows,
      highlighterExpressions,
      timeZone,
      onClickFilterLabel,
      onClickFilterOutLabel,
      rowLimit,
      theme,
      allowDetails,
      previewLimit,
      getFieldLinks,
      disableCustomHorizontalScroll,
    } = this.props;
    const { renderAll } = this.state;
    const { logsRowsTable, logsRowsHorizontalScroll } = getLogRowStyles(theme);
    const dedupedRows = deduplicatedRows ? deduplicatedRows : logRows;
    const hasData = logRows && logRows.length > 0;
    const dedupCount = dedupedRows
      ? dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
      : 0;
    const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;

    // For horizontal scrolling we can't use CustomScrollbar as it causes the problem with logs context - it is not visible
    // for top log rows. Therefore we use CustomScrollbar only in LogsPanel and for Explore, we use custom css styling.
    const horizontalScrollWindow = wrapLogMessage && !disableCustomHorizontalScroll ? '' : logsRowsHorizontalScroll;

    // Staged rendering
    const processedRows = dedupedRows ? dedupedRows : [];
    const firstRows = processedRows.slice(0, previewLimit!);
    const rowCount = Math.min(processedRows.length, rowLimit!);
    const lastRows = processedRows.slice(previewLimit!, rowCount);

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = this.makeGetRows(processedRows);
    const getRowContext = this.props.getRowContext ? this.props.getRowContext : () => Promise.resolve([]);

    return (
      <div className={horizontalScrollWindow}>
        <table className={logsRowsTable}>
          <tbody>
            {hasData &&
              firstRows.map((row, index) => (
                <LogRow
                  key={row.uid}
                  getRows={getRows}
                  getRowContext={getRowContext}
                  highlighterExpressions={highlighterExpressions}
                  row={row}
                  showContextToggle={showContextToggle}
                  showDuplicates={showDuplicates}
                  showLabels={showLabels}
                  showTime={showTime}
                  wrapLogMessage={wrapLogMessage}
                  timeZone={timeZone}
                  allowDetails={allowDetails}
                  onClickFilterLabel={onClickFilterLabel}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  getFieldLinks={getFieldLinks}
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
                  wrapLogMessage={wrapLogMessage}
                  timeZone={timeZone}
                  allowDetails={allowDetails}
                  onClickFilterLabel={onClickFilterLabel}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  getFieldLinks={getFieldLinks}
                />
              ))}
            {hasData && !renderAll && (
              <tr>
                <td colSpan={5}>Rendering {rowCount - previewLimit!} rows...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
}

export const LogRows = withTheme(UnThemedLogRows);
LogRows.displayName = 'LogsRows';
