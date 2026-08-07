import { debounce } from 'lodash';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { type Field } from '@grafana/data';
import {
  type Column,
  type ColumnWidths,
  type DataGridHandle,
  type DataGridProps,
  type SortColumn,
} from '@grafana/react-data-grid';
import { type MatcherScope } from '@grafana/schema';

import { useTheme2 } from '../../../../themes/ThemeContext';
import { type TableColumnResizeActionCallback } from '../../types';
import { IS_SAFARI_26 } from '../styles';
import { type GetActionsFunctionLocal, type TableRow, type TableSummaryRow, type TypographyCtx } from '../types';
import { extractPixelValue, getDisplayName } from '../utils/fields';
import { createTypographyContext } from '../utils/height';
import { buildNestedColumnWidthsMap, computeColWidths, computeContentAwareColWidths } from '../utils/width';

/**
 * When present, columns without a configured width are sized to fit their content
 * ({@link computeContentAwareColWidths}) rather than sharing the leftover space evenly. Gated by
 * the `table.autoColumnWidths` feature toggle and threaded down as a prop.
 */
export interface ContentAwareWidths {
  typographyCtx: TypographyCtx;
  /** medium-weight context for measuring header labels; see {@link ContentAwareColWidthsOptions} */
  headerTypographyCtx?: TypographyCtx;
  showTypeIcons?: boolean;
  getActions?: GetActionsFunctionLocal;
  sortColumns?: SortColumn[];
}

const pickColWidths = (fields: Field[], availWidth: number, contentAware?: ContentAwareWidths): number[] =>
  contentAware ? computeContentAwareColWidths(fields, availWidth, contentAware) : computeColWidths(fields, availWidth);

interface UseContentAwareWidthsOptions {
  enabled: boolean;
  typographyCtx: TypographyCtx;
  showTypeIcons?: boolean;
  getActions?: GetActionsFunctionLocal;
  sortColumns?: SortColumn[];
}

/**
 * Assembles the {@link ContentAwareWidths} options for the column width hooks, or `undefined` when
 * content-aware widths are disabled. Header labels render at medium weight, so they are measured
 * with a separate typography context.
 */
export function useContentAwareWidths({
  enabled,
  typographyCtx,
  showTypeIcons = false,
  getActions,
  sortColumns,
}: UseContentAwareWidthsOptions): ContentAwareWidths | undefined {
  const theme = useTheme2();
  return useMemo(
    () =>
      enabled
        ? {
            typographyCtx,
            headerTypographyCtx: createTypographyContext(
              theme.typography.fontSize,
              theme.typography.fontFamily,
              extractPixelValue(theme.typography.body.letterSpacing!) * theme.typography.fontSize,
              theme.typography.fontWeightMedium
            ),
            showTypeIcons,
            getActions,
            sortColumns,
          }
        : undefined,
    [enabled, theme, typographyCtx, showTypeIcons, getActions, sortColumns]
  );
}

interface UseNestedColWidthsOptions {
  nestedVisibleFields: Field[];
  availableWidth: number;
  structureRev?: number;
  contentAware?: ContentAwareWidths;
}

interface UseNestedColWidthsResult {
  nestedFieldWidths: number[];
  nestedColWidths: ColumnWidths;
  handleNestedColumnWidthsChange: (newColWidths: ColumnWidths) => void;
}

/**
 * Manages per-column widths for nested tables.
 */
export function useNestedColWidths({
  nestedVisibleFields,
  availableWidth,
  structureRev,
  contentAware,
}: UseNestedColWidthsOptions): UseNestedColWidthsResult {
  // before we do anything, figure out what the widths are based on the panel configuration.
  const configuredWidths = useMemo(
    () => pickColWidths(nestedVisibleFields, availableWidth, contentAware),
    [nestedVisibleFields, availableWidth, contentAware]
  );

  const [nestedFieldWidths, setNestedFieldWidths] = useState(() => configuredWidths);
  // Previous config-derived widths, so we can tell which columns actually changed upstream.
  const prevConfiguredWidths = useRef(configuredWidths);

  // Re-sync from config-derived widths whenever they change — structure changes and, crucially,
  // panel resize (availableWidth feeds configuredWidths), so content-aware auto columns re-flow to
  // the new width. We adopt a column's new width only when its *config-derived* width changed; a
  // column that changed only locally (an in-progress manual drag, which persists to field config
  // later on pointer-up) keeps its local width, so an interleaved resize doesn't clobber the drag.
  useEffect(() => {
    const prevConfigured = prevConfiguredWidths.current;
    prevConfiguredWidths.current = configuredWidths;
    setNestedFieldWidths((current) => {
      if (current.length !== configuredWidths.length) {
        return configuredWidths;
      }
      let changed = false;
      const next = current.map((width, i) => {
        if (configuredWidths[i] !== prevConfigured[i]) {
          changed = changed || width !== configuredWidths[i];
          return configuredWidths[i];
        }
        return width;
      });
      return changed ? next : current;
    });
  }, [configuredWidths, structureRev]);

  // this is the representation that react-data-grid wants, which we derive from the source of truth (nestedFieldWidths) on every render
  const nestedColWidths = useMemo(
    () => buildNestedColumnWidthsMap(nestedVisibleFields, nestedFieldWidths),
    [nestedVisibleFields, nestedFieldWidths]
  );

  const handleNestedColumnWidthsChange = useCallback(
    (newColWidths: ColumnWidths) => {
      setNestedFieldWidths(
        nestedVisibleFields.map((f, idx) => {
          const entry = newColWidths.get(getDisplayName(f));
          // ColumnWidth always has a width property (both 'resized' and 'measured' variants)
          return entry != null ? entry.width : nestedFieldWidths[idx];
        })
      );
    },
    [nestedVisibleFields, nestedFieldWidths]
  );

  return { nestedFieldWidths, nestedColWidths, handleNestedColumnWidthsChange };
}

export function useColWidths(
  visibleFields: Field[],
  availableWidth: number,
  frozenColumns?: number,
  resetKey?: Symbol,
  contentAware?: ContentAwareWidths
): [number[], number] {
  const widths = useMemo(
    () => pickColWidths(visibleFields, availableWidth, contentAware),
    // Width override removals can mutate width config onto existing field objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleFields, availableWidth, resetKey, contentAware]
  );

  // this is to avoid buggy situations where all visible columns are frozen
  const numFrozenColsFullyInView = useMemo(() => {
    if (!frozenColumns || frozenColumns <= 0) {
      return -1;
    }

    const fullyVisibleCols = widths.reduce(
      ([count, remainingWidth], nextWidth) => {
        if (remainingWidth - nextWidth >= 0) {
          return [count + 1, remainingWidth - nextWidth];
        }
        return [count, 0];
      },
      [0, availableWidth]
    )[0];

    // de-noise memoized changes to the columns array, and only change this
    // number when the number of frozen columns changes or once there are fewer
    // visible columns than the number of frozen columns.
    return Math.min(fullyVisibleCols, frozenColumns);
  }, [widths, availableWidth, frozenColumns]);

  return [widths, numFrozenColsFullyInView];
}

/**
 * react-data-grid is a little unwieldy when it comes to column resize events.
 * we want to detect a few different column resize signals:
 *   - dragging the handle (only want to dispatch when handle is released)
 *   - double-clicking the handle (sets the column to the minimum width to fit content)
 * `onColumnResize` dispatches events throughout a dragged resize, and `onColumnWidthsChanged` doesn't
 * emit an event when double-click resizing occurs, so we have to build something custom on top of these
 * behaviors in order to get everything working.
 */
interface UseColumnResizeState {
  columnKey: string | undefined;
  width: number;
  fieldScope?: MatcherScope;
}

const INITIAL_COL_RESIZE_STATE = Object.freeze({ columnKey: undefined, width: 0 }) satisfies UseColumnResizeState;

export function useColumnResize(
  onColumnResize: TableColumnResizeActionCallback = () => {},
  fieldScope?: MatcherScope
): DataGridProps<TableRow, TableSummaryRow>['onColumnResize'] {
  // these must be refs. if we used setState, we would run into race conditions with these event listeners
  const colResizeState = useRef<UseColumnResizeState>({ ...INITIAL_COL_RESIZE_STATE });
  const pointerIsDown = useRef(false);

  // to detect whether we got a double-click resize, we track whether the pointer is currently down
  useLayoutEffect(() => {
    function pointerDown(_event: PointerEvent) {
      pointerIsDown.current = true;
    }

    function pointerUp(_event: PointerEvent) {
      pointerIsDown.current = false;
    }

    window.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointerup', pointerUp);

    return () => {
      window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
    };
  });

  const dispatchEvent = useCallback(() => {
    if (colResizeState.current.columnKey) {
      onColumnResize(
        colResizeState.current.columnKey,
        Math.floor(colResizeState.current.width),
        colResizeState.current.fieldScope
      );
      colResizeState.current = { ...INITIAL_COL_RESIZE_STATE };
    }
    window.removeEventListener('click', dispatchEvent, { capture: true });
  }, [onColumnResize]);

  // this is the callback that gets passed to react-data-grid
  const dataGridResizeHandler = useCallback(
    (column: Column<TableRow, TableSummaryRow>, width: number) => {
      if (!colResizeState.current.columnKey) {
        window.addEventListener('click', dispatchEvent, { capture: true });
      }

      colResizeState.current.columnKey = column.key;
      colResizeState.current.width = width;

      if (fieldScope) {
        colResizeState.current.fieldScope = fieldScope;
      }

      // when double clicking to resize, this handler will fire, but the pointer will not be down,
      // meaning that we should immediately flush the new width
      if (!pointerIsDown.current) {
        dispatchEvent();
      }
    },
    [fieldScope, dispatchEvent]
  );

  return dataGridResizeHandler;
}

export function useScrollbarWidth(ref: RefObject<DataGridHandle | null>, height: number) {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const updateScrollbarDimensions = debounce(() => {
    const el = ref.current?.element;
    if (el) {
      setScrollbarWidth(el!.offsetWidth - el!.clientWidth);
    }
  }, 150);

  useLayoutEffect(() => {
    const el = ref.current?.element;
    if (!el || IS_SAFARI_26) {
      return;
    }

    updateScrollbarDimensions();

    const resizeObserver = new ResizeObserver(updateScrollbarDimensions);
    resizeObserver.observe(el);
    return () => {
      resizeObserver.disconnect();
    };
  }, [ref, height, updateScrollbarDimensions]);

  return scrollbarWidth;
}
