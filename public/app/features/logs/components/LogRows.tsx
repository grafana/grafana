import { cx } from '@emotion/css';
import { MouseEvent, ReactNode, useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';

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
import { ConfirmModal, Icon, PopoverContent, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { PopoverMenu } from '../../explore/Logs/PopoverMenu';
import { UniqueKeyMaker } from '../UniqueKeyMaker';
import { disablePopoverMenu, enablePopoverMenu, isPopoverMenuDisabled, sortLogRows, targetIsElement } from '../utils';

//Components
import { LogRow } from './LogRow';
import { PreviewLogRow } from './PreviewLogRow';
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
    const [previewSize, setPreviewSize] = useState(
      /**
       * If renderPreview is enabled, either half of the log rows or twice the screen size of log rows will be rendered.
       * The biggest of those values will be used. Else, all rows are rendered.
       */
      renderPreview && !permalinkedRowId
        ? Math.max(2 * Math.ceil(window.innerHeight / 20), Math.ceil(logRows.length / 3))
        : Infinity
    );
    const [popoverState, setPopoverState] = useState<PopoverStateType>({
      selection: '',
      selectedRow: null,
      popoverMenuCoordinates: { x: 0, y: 0 },
    });
    const [showDisablePopoverOptions, setShowDisablePopoverOptions] = useState(false);
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
    const keyMaker = new UniqueKeyMaker();

    useEffect(() => {
      return () => {
        if (handleDeselectionRef.current) {
          document.removeEventListener('click', handleDeselectionRef.current);
          document.removeEventListener('contextmenu', handleDeselectionRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (!scrollElement) {
        return;
      }

      function renderAll() {
        setPreviewSize(Infinity);
        scrollElement?.removeEventListener('scroll', renderAll);
        scrollElement?.removeEventListener('wheel', renderAll);
      }

      scrollElement.addEventListener('scroll', renderAll);
      scrollElement.addEventListener('wheel', renderAll);
    }, [logRows.length, scrollElement]);

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
      if (!config.featureToggles.logRowsPopoverMenu || isPopoverMenuDisabled()) {
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
        if (e.altKey) {
          enablePopoverMenu();
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

    const onDisablePopoverMenu = useCallback(() => {
      setShowDisablePopoverOptions(true);
    }, []);

    const onDisableCancel = useCallback(() => {
      setShowDisablePopoverOptions(false);
    }, []);

    const onDisableConfirm = useCallback(() => {
      disablePopoverMenu();
      setShowDisablePopoverOptions(false);
    }, []);

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
            onDisable={onDisablePopoverMenu}
          />
        )}
        {showDisablePopoverOptions && (
          <ConfirmModal
            isOpen
            title={t('logs.log-rows.disable-popover.title', 'Disable menu')}
            body={
              <>
                <Trans i18nKey="logs.log-rows.disable-popover.message">
                  You are about to disable the logs filter menu. To re-enable it, select text in a log line while
                  holding the alt key.
                </Trans>
                <div className={styles.shortcut}>
                  <Icon name="keyboard" />
                  <Trans i18nKey="logs.log-rows.disable-popover-message.shortcut">alt+select to enable again</Trans>
                </div>
              </>
            }
            confirmText={t('logs.log-rows.disable-popover.confirm', 'Confirm')}
            icon="exclamation-triangle"
            onConfirm={onDisableConfirm}
            onDismiss={onDisableCancel}
          />
        )}
        <table className={cx(styles.logsRowsTable, props.overflowingContent ? '' : styles.logsRowsTableContain)}>
          <tbody>
            {orderedRows.map((row, index) =>
              index < previewSize ? (
                <LogRow
                  key={keyMaker.getKey(row.uid)}
                  getRows={getRows}
                  row={row}
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
                  pinned={props.pinnedRowId === row.uid || pinnedLogs?.some((logId) => logId === row.rowId)}
                  isFilterLabelActive={props.isFilterLabelActive}
                  handleTextSelection={handleSelection}
                  enableLogDetails={enableLogDetails}
                  {...props}
                />
              ) : (
                <PreviewLogRow
                  key={`preview_${keyMaker.getKey(row.uid)}`}
                  enableLogDetails={false}
                  getRows={getRows}
                  onOpenContext={openContext}
                  styles={styles}
                  showDuplicates={showDuplicates}
                  {...props}
                  row={row}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    );
  }
);
