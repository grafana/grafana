import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  type ActionModel,
  cacheFieldDisplayNames,
  DashboardCursorSync,
  type DataFrame,
  type Field,
  type FieldConfigSource,
  getFieldDisplayName,
  type InterpolateFunction,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  useFlagTableAutoColumnWidths,
  useFlagTablePaginationPageSize,
  useFlagTableRefresh,
  useFlagTableRefreshNewFeatures,
} from '@grafana/runtime/internal';
import { type TableOptions } from '@grafana/schema';
import { useAdHocTransformations, usePanelContext } from '@grafana/ui';
import { getVisibleFields } from '@grafana/ui/internal';
import { getConfig } from 'app/core/config';

import { decodeAdHocColumns, encodeColumnOrder, encodeHiddenColumns, frameFilterFor } from './adHocColumns';
import { getCellActions } from './utils';

type GetActions = (frame: DataFrame, field: Field, rowIndex: number) => Array<ActionModel<Field>>;

/**
 * Caches per-field display names on the data frames. TableNG's `getDisplayName` relies on the cached
 * `field.state.displayName`, so this must run during render (via `useMemo`, not `useEffect`) before the
 * table reads it. Panels that apply field overrides clearing the cache to `null` depend on this step.
 */
export function useCacheFieldDisplayNames(series: DataFrame[]): void {
  useMemo(() => {
    cacheFieldDisplayNames(series);
  }, [series]);
}

/**
 * Returns a memoized `getActions` callback for a table's cells. Actions are only resolved when the panel
 * context reports that the user is allowed to execute them; otherwise an empty array is returned.
 */
export function useCellActions(replaceVariables: InterpolateFunction | undefined): GetActions {
  const panelContext = usePanelContext();
  const userCanExecuteActions = useMemo(() => panelContext.canExecuteActions?.() ?? false, [panelContext]);
  return useCallback(
    (frame, field, rowIndex) => (userCanExecuteActions ? getCellActions(frame, field, rowIndex, replaceVariables) : []),
    [replaceVariables, userCanExecuteActions]
  );
}

/**
 * Whether the shared crosshair should be enabled for the table. Requires the feature toggle to be on and
 * the panel context to have cursor sync enabled to something other than `Off`.
 */
export function useTableSharedCrosshair(): boolean {
  const panelContext = usePanelContext();
  return (
    Boolean(config.featureToggles.tableSharedCrosshair) &&
    Boolean(panelContext.sync) &&
    panelContext.sync!() !== DashboardCursorSync.Off
  );
}

type CommonTableOptions = Pick<
  TableOptions,
  | 'showHeader'
  | 'showTypeIcons'
  | 'sortBy'
  | 'frozenColumns'
  | 'enablePagination'
  | 'pageSize'
  | 'cellHeight'
  | 'maxRowHeight'
  | 'disableKeyboardEvents'
>;

/**
 * Maps the panel options and field config that are common to every TableNG-based panel into the matching
 * TableNG props. Props that vary per panel (data, width, height, sort/resize handlers, `sortByBehavior`)
 * are left to the caller. Spread the result onto `<TableNG {...props} />`.
 */
export function useCommonTableProps(options: CommonTableOptions, fieldConfig: FieldConfigSource) {
  const contentAwareWidthsEnabled = useFlagTableAutoColumnWidths();
  const paginationPageSizeEnabled = useFlagTablePaginationPageSize();
  const tableRefreshEnabled = useFlagTableRefresh();

  return useMemo(
    () => ({
      noHeader: !options.showHeader,
      noValue: fieldConfig.defaults.noValue,
      showTypeIcons: options.showTypeIcons,
      resizable: true,
      sortBy: options.sortBy,
      frozenColumns: options.frozenColumns?.left,
      enablePagination: options.enablePagination,
      // pageSize is gated behind the feature toggle; when disabled the page size falls back to the panel height
      pageSize: paginationPageSizeEnabled ? options.pageSize : undefined,
      cellHeight: options.cellHeight,
      maxRowHeight: options.maxRowHeight,
      disableKeyboardEvents: options.disableKeyboardEvents,
      disableSanitizeHtml: getConfig().disableSanitizeHtml,
      contentAwareWidthsEnabled,
      tableRefreshEnabled,
    }),
    [
      options.showHeader,
      options.showTypeIcons,
      options.sortBy,
      options.frozenColumns?.left,
      options.enablePagination,
      options.pageSize,
      options.cellHeight,
      options.maxRowHeight,
      options.disableKeyboardEvents,
      fieldConfig.defaults.noValue,
      contentAwareWidthsEnabled,
      paginationPageSizeEnabled,
      tableRefreshEnabled,
    ]
  );
}

/**
 * Whether the table panel's refreshed column features are on: reorder, hide/show, the column
 * sidebar, and filtering on every column.
 *
 * Read here rather than in `useCommonTableProps` because that hook is shared with the logs table,
 * and every TableNG caller other than the table panel keeps opting in per field.
 */
export function useTableRefreshNewFeatures(): boolean {
  // Both read unconditionally: `&&` between the two calls would skip the second one whenever the
  // first is false, which changes the hook order between renders.
  const newFeaturesEnabled = useFlagTableRefreshNewFeatures();
  const refreshEnabled = useFlagTableRefresh();

  // The interactions live in the refreshed header — its drag handle and its column menu — so the
  // toggle for them only means anything on top of the refreshed table.
  return newFeaturesEnabled && refreshEnabled;
}

/**
 * Binds a table's column order and visibility to the panel's ad-hoc transformation stage, returning
 * the controlled props for `<TableNG>` — or undefined, which leaves the table to keep the view
 * locally as it did before.
 *
 * Returns undefined when the host has no stage to offer, when the toggle is off, or when the frame
 * on screen cannot be addressed safely: duplicate display names make the identity key ambiguous,
 * and nested frames render through a path with none of these affordances.
 */
export function useAdHocColumnState(frames: DataFrame[], frameIndex: number, enabled: boolean) {
  const adHoc = useAdHocTransformations();
  const stage = useSyncExternalStore(
    useCallback((onChange) => (adHoc ? adHoc.subscribe(onChange) : () => {}), [adHoc]),
    useCallback(() => adHoc?.get(), [adHoc])
  );

  const sourceFrame = enabled && adHoc ? adHoc.getSourceSeries()[frameIndex] : undefined;

  const catalog = useMemo(() => {
    if (!sourceFrame) {
      return undefined;
    }

    // The captured frames are raw — no field config, no overrides — so display names have to be
    // derived here rather than read off `field.state`.
    const source = adHoc!.getSourceSeries();
    cacheFieldDisplayNames(source);

    const names = getVisibleFields(sourceFrame.fields).map((field) => getFieldDisplayName(field, sourceFrame, source));

    // A name that means two columns cannot be hidden or reordered independently, so stay out of it.
    return new Set(names).size === names.length ? names : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adHoc, sourceFrame]);

  const frameFilter = useMemo(() => frameFilterFor(frames, frameIndex), [frames, frameIndex]);

  const onColumnOrderChange = useCallback(
    (order: string[]) => adHoc?.set(encodeColumnOrder(stage ?? [], order, frameFilter)),
    [adHoc, stage, frameFilter]
  );

  const onHiddenColumnsChange = useCallback(
    (hidden: ReadonlySet<string>) => adHoc?.set(encodeHiddenColumns(stage ?? [], hidden, frameFilter)),
    [adHoc, stage, frameFilter]
  );

  return useMemo(() => {
    if (!catalog || !stage) {
      return undefined;
    }

    const { columnOrder, hiddenColumns } = decodeAdHocColumns(stage, catalog, frameFilter);

    return {
      columnOrder,
      hiddenColumns,
      columnCatalog: columnOrder ?? catalog,
      onColumnOrderChange,
      onHiddenColumnsChange,
    };
  }, [catalog, stage, frameFilter, onColumnOrderChange, onHiddenColumnsChange]);
}
