import { cx } from '@emotion/css';
import { MouseEvent, ReactNode, useState, useMemo, useCallback, useRef, useEffect, memo, CSSProperties } from 'react';
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
import { PopoverContent, useTheme2 } from '@grafana/ui';

import { PopoverMenu } from '../../explore/Logs/PopoverMenu';
import { sortLogRows, targetIsElement } from '../utils';

import { LogRow } from './LogRow';
import { restructureLog } from './LogRowMessage';
import { getLogRowStyles } from './getLogRowStyles';

export interface Props {
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
  /**
   * If false or undefined, the `contain:strict` css property will be added to the wrapping `<table>` for performance reasons.
   * Any overflowing content will be clipped at the table boundary.
   */
  overflowingContent?: boolean;
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
  logRowMenuIconsBefore?: ReactNode[];
  logRowMenuIconsAfter?: ReactNode[];
  scrollElement: HTMLDivElement | null;
  renderPreview?: boolean;
}

type PopoverStateType = {
  selection: string;
  selectedRow: LogRowModel | null;
  popoverMenuCoordinates: { x: number; y: number };
};

export const LogRows = memo(
  ({
    deduplicatedRows,
    logRows = [],
    dedupStrategy,
    logsSortOrder,
    previewLimit,
    pinnedLogs,
    onOpenContext,
    onClickFilterOutString,
    onClickFilterString,
    scrollElement,
    renderPreview = false,
    enableLogDetails,
    permalinkedRowId,
    ...props
  }: Props) => {
    const [showLogDetails, setShowLogDetails] = useState<number[]>([]);
    const [popoverState, setPopoverState] = useState<PopoverStateType>({
      selection: '',
      selectedRow: null,
      popoverMenuCoordinates: { x: 0, y: 0 },
    });
    const logRowsRef = useRef<HTMLDivElement>(null);
    const theme = useTheme2();
    const styles = getLogRowStyles(theme);
    const dedupedRows = deduplicatedRows ? deduplicatedRows : logRows;
    const dedupCount = useMemo(
      () => dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0),
      [dedupedRows]
    );
    const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;
    const orderedRows = useMemo(
      () => (logsSortOrder ? sortLogRows(dedupedRows, logsSortOrder) : dedupedRows),
      [dedupedRows, logsSortOrder]
    );
    // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
    const getRows = useMemo(() => () => orderedRows, [orderedRows]);
    const handleDeselectionRef = useRef<((e: Event) => void) | null>(null);

    useEffect(() => {
      return () => {
        if (handleDeselectionRef.current) {
          document.removeEventListener('click', handleDeselectionRef.current);
          document.removeEventListener('contextmenu', handleDeselectionRef.current);
        }
      };
    }, []);

    /**
     * Toggle the `contextIsOpen` state when a context of one LogRow is opened in order to not show the menu of the other log rows.
     */
    const openContext = useCallback(
      (row: LogRowModel, onClose: () => void): void => {
        if (onOpenContext) {
          onOpenContext(row, onClose);
        }
      },
      [onOpenContext]
    );

    const popoverMenuSupported = useCallback(() => {
      if (!config.featureToggles.logRowsPopoverMenu) {
        return false;
      }
      return Boolean(onClickFilterOutString || onClickFilterString);
    }, [onClickFilterOutString, onClickFilterString]);

    const closePopoverMenu = useCallback(() => {
      if (handleDeselectionRef.current) {
        document.removeEventListener('click', handleDeselectionRef.current);
        document.removeEventListener('contextmenu', handleDeselectionRef.current);
        handleDeselectionRef.current = null;
      }
      setPopoverState({
        selection: '',
        popoverMenuCoordinates: { x: 0, y: 0 },
        selectedRow: null,
      });
    }, []);

    const handleDeselection = useCallback(
      (e: Event) => {
        if (targetIsElement(e.target) && !logRowsRef.current?.contains(e.target)) {
          // The mouseup event comes from outside the log rows, close the menu.
          closePopoverMenu();
          return;
        }
        if (document.getSelection()?.toString()) {
          return;
        }
        closePopoverMenu();
      },
      [closePopoverMenu]
    );

    const handleSelection = useCallback(
      (e: MouseEvent<HTMLElement>, row: LogRowModel): boolean => {
        const selection = document.getSelection()?.toString();
        if (!selection) {
          return false;
        }
        if (popoverMenuSupported() === false) {
          // This signals onRowClick inside LogRow to skip the event because the user is selecting text
          return selection ? true : false;
        }

        if (!logRowsRef.current) {
          return false;
        }

        const MENU_WIDTH = 270;
        const MENU_HEIGHT = 105;
        const x = e.clientX + MENU_WIDTH > window.innerWidth ? window.innerWidth - MENU_WIDTH : e.clientX;
        const y = e.clientY + MENU_HEIGHT > window.innerHeight ? window.innerHeight - MENU_HEIGHT : e.clientY;

        setPopoverState({
          selection,
          popoverMenuCoordinates: { x, y },
          selectedRow: row,
        });
        handleDeselectionRef.current = handleDeselection;
        document.addEventListener('click', handleDeselection);
        document.addEventListener('contextmenu', handleDeselection);
        return true;
      },
      [handleDeselection, popoverMenuSupported]
    );

    const onRowClick = useCallback(
      (e: MouseEvent<HTMLTableRowElement>, row: LogRowModel) => {
        if (handleSelection(e, row)) {
          // Event handled by the parent.
          return;
        }

        if (!enableLogDetails) {
          return;
        }

        const rowIndex = orderedRows.indexOf(row);
        if (rowIndex === undefined) {
          return;
        }
        const newShowLogDetails: number[] = [...showLogDetails];
        if (showLogDetails.indexOf(rowIndex) >= 0) {
          newShowLogDetails.splice(showLogDetails.indexOf(rowIndex), 1);
        } else {
          newShowLogDetails.push(rowIndex);
        }

        setShowLogDetails(newShowLogDetails);
      },
      [enableLogDetails, handleSelection, orderedRows, showLogDetails]
    );

    const isRowExpanded = useCallback(
      (row: LogRowModel) => {
        const rowIndex = orderedRows.indexOf(row) ?? -1;
        return showLogDetails.indexOf(rowIndex) >= 0;
      },
      [orderedRows, showLogDetails]
    );

    const Row = useCallback(
      ({ index, style }: { index: number; style: CSSProperties }) => {
        return (
          <LogRow
            style={style}
            getRows={getRows}
            row={orderedRows[index]}
            showDuplicates={showDuplicates}
            logsSortOrder={logsSortOrder}
            onOpenContext={openContext}
            styles={styles}
            onPermalinkClick={props.onPermalinkClick}
            scrollIntoView={props.scrollIntoView}
            permalinkedRowId={permalinkedRowId}
            onPinLine={props.onPinLine}
            onUnpinLine={props.onUnpinLine}
            pinLineButtonTooltipTitle={props.pinLineButtonTooltipTitle}
            pinned={
              props.pinnedRowId === orderedRows[index].uid ||
              pinnedLogs?.some((logId) => logId === orderedRows[index].rowId)
            }
            isFilterLabelActive={props.isFilterLabelActive}
            handleTextSelection={popoverMenuSupported() ? handleSelection : undefined}
            showDetails={isRowExpanded(orderedRows[index])}
            onRowClick={onRowClick}
            enableLogDetails={enableLogDetails}
            {...props}
          />
        );
      },
      [
        enableLogDetails,
        getRows,
        handleSelection,
        isRowExpanded,
        logsSortOrder,
        onRowClick,
        openContext,
        orderedRows,
        permalinkedRowId,
        pinnedLogs,
        popoverMenuSupported,
        props,
        showDuplicates,
        styles,
      ]
    );

    const height = window.innerHeight * 0.75;

    return (
      <div className={styles.logRows} ref={logRowsRef}>
        {popoverState.selection && popoverState.selectedRow && (
          <PopoverMenu
            close={closePopoverMenu}
            row={popoverState.selectedRow}
            selection={popoverState.selection}
            {...popoverState.popoverMenuCoordinates}
            onClickFilterString={onClickFilterString}
            onClickFilterOutString={onClickFilterOutString}
          />
        )}
        <table className={cx(styles.logsRowsTable, props.overflowingContent ? '' : styles.logsRowsTableContain)}>
          <tbody>
            <VariableSizeList
              height={height}
              itemCount={orderedRows?.length || 0}
              itemSize={estimateRowHeight.bind(
                null,
                orderedRows,
                isRowExpanded,
                props.prettifyLogMessage,
                props.wrapLogMessage,
                props.showTime,
                props.showLabels
              )}
              itemKey={(index: number) => index}
              width={'100%'}
              layout="vertical"
            >
              {Row}
            </VariableSizeList>
          </tbody>
        </table>
      </div>
    );
  }
);

/**
 * Heuristic function to estimate row size. Needs to be updated when log row styles changes.
 * It does not need to be exact, just know the amount of lines that the message will use if the
 * message is wrapped.
 */
const estimateRowHeight = (
  rows: LogRowModel[],
  isRowExpanded: (r: LogRowModel) => boolean,
  prettifyLogMessage: boolean,
  wrapLogMessage: boolean,
  showTime: boolean,
  showLabels: boolean,
  index: number
) => {
  const rowHeight = 20.14;
  const lineHeight = 18.5;
  const detailsHeight = isRowExpanded(rows[index]) ? window.innerHeight * 0.35 + 41 : 0;
  const line = restructureLog(rows[index].raw, prettifyLogMessage, wrapLogMessage, isRowExpanded(rows[index]));

  if (prettifyLogMessage) {
    try {
      const parsed: Record<string, string> = JSON.parse(line);
      let jsonHeight = 2 * rowHeight; // {}
      for (let key in parsed) {
        jsonHeight +=
          estimateMessageLines(`  "${key}": "${parsed[key]}"`, wrapLogMessage, showTime, showLabels) * lineHeight;
      }
      return jsonHeight + detailsHeight;
    } catch (e) {
      console.error(e);
    }
  }
  if (!wrapLogMessage) {
    return rowHeight + detailsHeight;
  }
  return estimateMessageLines(line, wrapLogMessage, showTime, showLabels) * rowHeight + detailsHeight;
};

const estimateMessageLines = (line: string, wrapLogMessage: boolean, showTime: boolean, showLabels: boolean) => {
  if (!wrapLogMessage) {
    return 1;
  }
  let margins = 48 + 65;
  if (showTime) {
    margins += 177;
  }
  if (showLabels) {
    margins += Math.round(window.innerWidth * 0.17);
  }
  const letter = 8.4;
  return Math.ceil((line.length * letter) / (window.innerWidth - margins));
};
