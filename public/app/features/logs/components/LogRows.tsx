import { cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import { PureComponent, MouseEvent, createRef, ReactNode, CSSProperties } from 'react';
import { VariableSizeList } from 'react-window';

import {
  TimeZone,
  LogsDedupStrategy,
  LogRowModel,
  Field,
  LinkModel,
  LogsSortOrder,
  CoreApp,
  DataFrame,
  LogRowContextOptions,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { withTheme2, Themeable2, PopoverContent } from '@grafana/ui';

import { PopoverMenu } from '../../explore/Logs/PopoverMenu';
import { UniqueKeyMaker } from '../UniqueKeyMaker';
import { sortLogRows, targetIsElement } from '../utils';

//Components
import { LogRow } from './LogRow';
import { restructureLog } from './LogRowMessage';
import { getLogRowStyles } from './getLogRowStyles';

export const PREVIEW_LIMIT = 100;

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
  displayedFields?: string[];
  app?: CoreApp;
  showContextToggle?: (row: LogRowModel) => boolean;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  onPinLine?: (row: LogRowModel, allowUnPin?: boolean) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  onLogRowHover?: (row?: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  getRowContextQuery?: (
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters?: boolean
  ) => Promise<DataQuery | null>;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  permalinkedRowId?: string;
  scrollIntoView?: (element: HTMLElement) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  pinnedRowId?: string;
  pinnedLogs?: string[];
  containerRendered?: boolean;
  /**
   * If false or undefined, the `contain:strict` css property will be added to the wrapping `<table>` for performance reasons.
   * Any overflowing content will be clipped at the table boundary.
   */
  overflowingContent?: boolean;
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
  logRowMenuIconsBefore?: ReactNode[];
  logRowMenuIconsAfter?: ReactNode[];
}

interface State {
  renderAll: boolean;
  selection: string;
  selectedRow: LogRowModel | null;
  popoverMenuCoordinates: { x: number; y: number };
  orderedRows: LogRowModel[];
  showDuplicates: boolean;
  keyMaker: UniqueKeyMaker;
}

class UnThemedLogRows extends PureComponent<Props, State> {
  renderAllTimer: number | null = null;
  logRowsRef = createRef<HTMLDivElement>();

  static defaultProps = {
    previewLimit: PREVIEW_LIMIT,
  };

  state: State = {
    renderAll: false,
    selection: '',
    selectedRow: null,
    popoverMenuCoordinates: { x: 0, y: 0 },
    orderedRows: [],
    showDuplicates: false,
    keyMaker: new UniqueKeyMaker(),
  };

  /**
   * Toggle the `contextIsOpen` state when a context of one LogRow is opened in order to not show the menu of the other log rows.
   */
  openContext = (row: LogRowModel, onClose: () => void): void => {
    if (this.props.onOpenContext) {
      this.props.onOpenContext(row, onClose);
    }
  };

  popoverMenuSupported() {
    if (!config.featureToggles.logRowsPopoverMenu) {
      return false;
    }
    return Boolean(this.props.onClickFilterOutString || this.props.onClickFilterString);
  }

  handleSelection = (e: MouseEvent<HTMLTableRowElement>, row: LogRowModel): boolean => {
    const selection = document.getSelection()?.toString();
    if (!selection) {
      return false;
    }
    if (this.popoverMenuSupported() === false) {
      // This signals onRowClick inside LogRow to skip the event because the user is selecting text
      return selection ? true : false;
    }

    if (!this.logRowsRef.current) {
      return false;
    }

    const MENU_WIDTH = 270;
    const MENU_HEIGHT = 105;
    const x = e.clientX + MENU_WIDTH > window.innerWidth ? window.innerWidth - MENU_WIDTH : e.clientX;
    const y = e.clientY + MENU_HEIGHT > window.innerHeight ? window.innerHeight - MENU_HEIGHT : e.clientY;

    this.setState({
      selection,
      popoverMenuCoordinates: { x, y },
      selectedRow: row,
    });
    document.addEventListener('click', this.handleDeselection);
    document.addEventListener('contextmenu', this.handleDeselection);
    return true;
  };

  handleDeselection = (e: Event) => {
    if (targetIsElement(e.target) && !this.logRowsRef.current?.contains(e.target)) {
      // The mouseup event comes from outside the log rows, close the menu.
      this.closePopoverMenu();
      return;
    }
    if (document.getSelection()?.toString()) {
      return;
    }
    this.closePopoverMenu();
  };

  closePopoverMenu = () => {
    document.removeEventListener('click', this.handleDeselection);
    document.removeEventListener('contextmenu', this.handleDeselection);
    this.setState({
      selection: '',
      popoverMenuCoordinates: { x: 0, y: 0 },
      selectedRow: null,
    });
  };
  
  componentDidUpdate(prevProps: Readonly<Props>): void {
    // How much nicer this would be with useEffect()
    const dependencyArray = ['deduplicatedRows', 'logRows', 'dedupStrategy', 'logsSortOrder', 'showLabels', 'showTime', 'wrapLogMessage', 'prettifyLogMessage'];
    const updated = dependencyArray.reduce((updated: boolean, attr: string) => {
      // @ts-expect-error
      return updated || prevProps[attr] !== this.props[attr];
    }, false);

    if (!updated) {
      if (!this.state.orderedRows.length) {
        this.updateLogRows();
      }
      return;
    }
    this.updateLogRows();
  }

  /**
   * When settings change, we need the virtualized list to re-render. Passing a new array to the list is not enough to trigger it.
   */
  virtualizedListKey = () => {
    const reRenderTriggers = ['dedupStrategy', 'logsSortOrder', 'showLabels', 'showTime', 'wrapLogMessage', 'prettifyLogMessage'];
    return reRenderTriggers.reduce((key: string, attr: string) => {
      // @ts-expect-error
      return `${key}${this.props[attr].toString()}`
    }, '');
  }

  updateLogRows() {
    const { deduplicatedRows, logRows, dedupStrategy, logsSortOrder } = this.props;
    const dedupedRows = deduplicatedRows ? deduplicatedRows : logRows;
    const dedupCount = dedupedRows
      ? dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
      : 0;
    const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;
    const processedRows = dedupedRows ? dedupedRows : [];
    const orderedRows = logsSortOrder ? this.sortLogs(processedRows, logsSortOrder) : processedRows;
    
    this.setState({
      orderedRows: [...orderedRows],
      showDuplicates
    });
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleDeselection);
    document.removeEventListener('contextmenu', this.handleDeselection);
    document.removeEventListener('selectionchange', this.handleDeselection);
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

  Row = ({ getRows, rows, showDuplicates, styles }: { getRows(): LogRowModel[], rows: LogRowModel[], showDuplicates: boolean, styles: ReturnType<typeof getLogRowStyles> }, { index, style }: { index: number, style: CSSProperties }) => {
    return <LogRow
      style={style}
      getRows={getRows}
      row={rows[index]}
      showDuplicates={showDuplicates}
      logsSortOrder={this.props.logsSortOrder}
      onOpenContext={this.openContext}
      styles={styles}
      onPermalinkClick={this.props.onPermalinkClick}
      scrollIntoView={this.props.scrollIntoView}
      permalinkedRowId={this.props.permalinkedRowId}
      onPinLine={this.props.onPinLine}
      onUnpinLine={this.props.onUnpinLine}
      pinLineButtonTooltipTitle={this.props.pinLineButtonTooltipTitle}
      pinned={this.props.pinnedRowId === rows[index].uid || this.props.pinnedLogs?.some((logId) => logId === rows[index].rowId)}
      isFilterLabelActive={this.props.isFilterLabelActive}
      handleTextSelection={this.popoverMenuSupported() ? this.handleSelection : undefined}
      {...this.props}
    />
  }

  /**
   * Heuristic function to estimate row size. Needs to be updated when log row styles changes.
   * It does not need to be exact, just know the amount of lines that the message will use if the
   * message is wrapped.
   */
  estimateRowHeight = (rows: LogRowModel[], index: number) => {
    const rowHeight = 20.14;
    const line = restructureLog(rows[index].raw, this.props.prettifyLogMessage);
    if (this.props.prettifyLogMessage) {
      try {
        const parsed: Record<string, string> = JSON.parse(line);
        let jsonHeight = 2 * rowHeight; // {}
        for (let key in parsed) {
          jsonHeight += this.estimateMessageLines(parsed[key]) * rowHeight;
        }
        return jsonHeight;
      } catch (e) {
        console.error(e);
      }
    }
    if (!this.props.wrapLogMessage) {
      return rowHeight;
    }
    return this.estimateMessageLines(line) * rowHeight;
  }

  estimateMessageLines = (line: string) => {
    const margins = 310;
    const letter = 7.34;
    return Math.ceil((line.length * letter) / (window.innerWidth - margins));
  }

  render() {
    const { deduplicatedRows, logRows, dedupStrategy, theme, logsSortOrder, previewLimit, ...rest } = this.props;
    const { orderedRows, showDuplicates } = this.state;
    const styles = getLogRowStyles(theme);

    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = this.makeGetRows(orderedRows);
    const height = window.innerHeight * 0.75;

    return (
      <div className={styles.logRows} ref={this.logRowsRef}>
        {this.state.selection && this.state.selectedRow && (
          <PopoverMenu
            close={this.closePopoverMenu}
            row={this.state.selectedRow}
            selection={this.state.selection}
            {...this.state.popoverMenuCoordinates}
            onClickFilterString={rest.onClickFilterString}
            onClickFilterOutString={rest.onClickFilterOutString}
          />
        )}
        <table className={cx(styles.logsRowsTable, this.props.overflowingContent ? '' : styles.logsRowsTableContain)}>
          <VariableSizeList
            key={this.virtualizedListKey()}
            height={height}
            itemCount={orderedRows?.length || 0}
            itemSize={this.estimateRowHeight.bind(this, orderedRows)}
            itemKey={(index: number) => this.state.keyMaker.getKey(orderedRows[index].uid)}
            width={'100%'}
            layout="vertical"
          >
            {this.Row.bind(this, { getRows, showDuplicates, rows: orderedRows, styles })}  
          </VariableSizeList>
        </table>
      </div>
    );
  }
}

export const LogRows = withTheme2(UnThemedLogRows);
LogRows.displayName = 'LogsRows';
