import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { TimeZone, LogsDedupStrategy, LogRowModel, Field, LinkModel, LogsSortOrder, sortLogRows } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogRow } from './LogRow';
import { RowContextOptions } from './LogRowContextProvider';
import { Button } from '../Button';

export const PREVIEW_LIMIT = 100;

export interface Props extends Themeable {
  logRows?: LogRowModel[];
  deduplicatedRows?: LogRowModel[];
  dedupStrategy: LogsDedupStrategy;
  highlighterExpressions?: string[];
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
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
  /**
   * Set to true to show "show more rows" allowing to render more logs.
   * Set to false to render all logs (preview on the first rendered + the rest after a delay).
   */
  lazyRendering: boolean;
}

interface State {
  lazyRendering: boolean;
  currentLimit: number;
}

class UnThemedLogRows extends PureComponent<Props, State> {
  renderAllTimer: number | null = null;

  static defaultProps = {
    previewLimit: PREVIEW_LIMIT,
  };

  state: State = {
    lazyRendering: false,
    currentLimit: this.props.previewLimit!,
  };

  componentDidMount() {
    // Staged rendering
    const { logRows, previewLimit, lazyRendering } = this.props;
    const rowCount = logRows ? logRows.length : 0;
    // Render all right away if not too far over the limit
    const renderAll = rowCount <= previewLimit! * 2;
    if (renderAll) {
      this.setState({ currentLimit: Infinity });
    } else if (!lazyRendering) {
      this.renderAllTimer = window.setTimeout(() => this.setState({ currentLimit: Infinity }), 2000);
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

  showMore = () => {
    this.setState(({ currentLimit }) => {
      return {
        currentLimit: currentLimit + PREVIEW_LIMIT,
      };
    });
  };

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
      theme,
      enableLogDetails,
      getFieldLinks,
      logsSortOrder,
      showDetectedFields,
      onClickShowDetectedField,
      onClickHideDetectedField,
      forceEscape,
      lazyRendering,
    } = this.props;
    const { currentLimit } = this.state;
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
    const visibleRows = orderedRows.slice(0, currentLimit!);
    const hasMoreData = visibleRows.length !== orderedRows.length;

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = this.makeGetRows(orderedRows);
    const getRowContext = this.props.getRowContext ? this.props.getRowContext : () => Promise.resolve([]);

    return (
      <table className={logsRowsTable}>
        <tbody>
          {hasData &&
            visibleRows.map((row, index) => (
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
                showDetectedFields={showDetectedFields}
                wrapLogMessage={wrapLogMessage}
                timeZone={timeZone}
                enableLogDetails={enableLogDetails}
                onClickFilterLabel={onClickFilterLabel}
                onClickFilterOutLabel={onClickFilterOutLabel}
                onClickShowDetectedField={onClickShowDetectedField}
                onClickHideDetectedField={onClickHideDetectedField}
                getFieldLinks={getFieldLinks}
                logsSortOrder={logsSortOrder}
                forceEscape={forceEscape}
              />
            ))}
          {hasData && hasMoreData && (
            <tr>
              {!lazyRendering && <td colSpan={5}>Rendering {orderedRows.length - currentLimit!} rows...</td>}
              {lazyRendering && (
                <td colSpan={5}>
                  <Button variant="secondary" size="md" style={{ marginTop: theme.spacing.sm }} onClick={this.showMore}>
                    Show more rows
                  </Button>
                </td>
              )}
            </tr>
          )}
        </tbody>
      </table>
    );
  }
}

export const LogRows = withTheme(UnThemedLogRows);
LogRows.displayName = 'LogsRows';
