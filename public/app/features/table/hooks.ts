import { useCallback, useMemo } from 'react';

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
import { supportsColumnManagement } from './tableCapabilities';
import { getCellActions } from './utils';

type GetActions = (frame: DataFrame, field: Field, rowIndex: number) => Array<ActionModel<Field>>;

export const TABLE_TRANSFORMATIONS_OWNER = 'grafana:table-view';

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
  | 'hoverOverflow'
  | 'zebraStriping'
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
  const refreshNewFeaturesEnabled = useFlagTableRefreshNewFeatures();

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
      hoverOverflow: options.hoverOverflow ?? true,
      zebraStriping: refreshNewFeaturesEnabled && options.zebraStriping,
      disableSanitizeHtml: getConfig().disableSanitizeHtml,
      contentAwareWidthsEnabled,
      tableRefreshEnabled,
      jsonSyntaxHighlightingEnabled: refreshNewFeaturesEnabled,
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
      options.hoverOverflow,
      options.zebraStriping,
      fieldConfig.defaults.noValue,
      contentAwareWidthsEnabled,
      paginationPageSizeEnabled,
      tableRefreshEnabled,
      refreshNewFeaturesEnabled,
    ]
  );
}

export function useTableRefreshNewFeatures(): boolean {
  // Read both hooks unconditionally to keep hook order stable.
  const newFeaturesEnabled = useFlagTableRefreshNewFeatures();
  const refreshEnabled = useFlagTableRefresh();

  return newFeaturesEnabled && refreshEnabled;
}

/** Returns controlled TableNG column state when the current frame can use the ad-hoc stage. */
export function useAdHocColumnState(frames: DataFrame[], frameIndex: number, enabled: boolean) {
  const adHoc = useAdHocTransformations(TABLE_TRANSFORMATIONS_OWNER);
  const stage = adHoc?.transformations;
  const sourceFrame =
    enabled && supportsColumnManagement(frames[frameIndex]) ? adHoc?.sourceSeries[frameIndex] : undefined;

  const catalog = useMemo(() => {
    if (!sourceFrame || !adHoc) {
      return undefined;
    }

    // Source frames have not had field config or overrides applied.
    const source = adHoc.sourceSeries.map((frame) => ({
      ...frame,
      fields: frame.fields.map((field) => ({ ...field, state: field.state ? { ...field.state } : undefined })),
    }));
    cacheFieldDisplayNames(source);

    const catalogFrame = source[frameIndex];
    const names = getVisibleFields(catalogFrame.fields).map((field) =>
      getFieldDisplayName(field, catalogFrame, source)
    );

    // Display names are the column identity, so duplicates cannot be managed independently.
    return new Set(names).size === names.length ? names : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adHoc, sourceFrame]);

  const frameFilter = useMemo(() => frameFilterFor(frames, frameIndex), [frames, frameIndex]);

  const onColumnOrderChange = useCallback(
    (order: string[]) => adHoc?.setTransformations(encodeColumnOrder(stage ?? [], order, frameFilter)),
    [adHoc, stage, frameFilter]
  );

  const onHiddenColumnsChange = useCallback(
    (hidden: ReadonlySet<string>) => adHoc?.setTransformations(encodeHiddenColumns(stage ?? [], hidden, frameFilter)),
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
