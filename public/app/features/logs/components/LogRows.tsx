import { cx } from '@emotion/css';
import {
  MouseEvent,
  ReactNode,
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';

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
import { UniqueKeyMaker } from '../UniqueKeyMaker';
import { sortLogRows, targetIsElement } from '../utils';

//Components
import { LogRow } from './LogRow';
import { getLogRowStyles } from './getLogRowStyles';

export const PREVIEW_LIMIT = 100;

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

/*interface State {
  renderAll: boolean;
  selection: string;
  selectedRow: LogRowModel | null;
  popoverMenuCoordinates: { x: number; y: number };
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
    document.removeEventListener('click', this.handleDeselection);
    document.removeEventListener('contextmenu', this.handleDeselection);
    document.removeEventListener('selectionchange', this.handleDeselection);
    if (this.renderAllTimer) {
      clearTimeout(this.renderAllTimer);
    }
  }
}*/

type PopoverStateType = {
  selection: string;
  selectedRow: LogRowModel | null;
  popoverMenuCoordinates: { x: number; y: number };
};

export const LogRows = ({
  deduplicatedRows,
  logRows = [],
  dedupStrategy,
  logsSortOrder,
  previewLimit,
  pinnedLogs,
  onOpenContext,
  onClickFilterOutString,
  onClickFilterString,
  ...props
}: Props) => {
  const [renderAll, setRenderAll] = useState(false);
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
  // Staged rendering
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

  const handleSelection = (e: MouseEvent<HTMLTableRowElement>, row: LogRowModel): boolean => {
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
  };

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
          {orderedRows.map((row) => (
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
              permalinkedRowId={props.permalinkedRowId}
              onPinLine={props.onPinLine}
              onUnpinLine={props.onUnpinLine}
              pinLineButtonTooltipTitle={props.pinLineButtonTooltipTitle}
              pinned={props.pinnedRowId === row.uid || pinnedLogs?.some((logId) => logId === row.rowId)}
              isFilterLabelActive={props.isFilterLabelActive}
              handleTextSelection={handleSelection}
              {...props}
            />
          ))}
          {!renderAll && (
            <tr>
              <td colSpan={5}>Rendering {orderedRows.length - previewLimit!} rows...</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
