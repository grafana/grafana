import { useCallback, useMemo } from 'react';

import {
  type ActionModel,
  cacheFieldDisplayNames,
  DashboardCursorSync,
  type DataFrame,
  type Field,
  type FieldConfigSource,
  type InterpolateFunction,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { useFlagTableRefactorNested } from '@grafana/runtime/internal';
import { type TableOptions } from '@grafana/schema';
import { usePanelContext } from '@grafana/ui';
import { getConfig } from 'app/core/config';

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
  const nestedRefactorEnabled = useFlagTableRefactorNested();

  return useMemo(
    () => ({
      noHeader: !options.showHeader,
      noValue: fieldConfig.defaults.noValue,
      showTypeIcons: options.showTypeIcons,
      resizable: true,
      sortBy: options.sortBy,
      frozenColumns: options.frozenColumns?.left,
      enablePagination: options.enablePagination,
      cellHeight: options.cellHeight,
      maxRowHeight: options.maxRowHeight,
      disableKeyboardEvents: options.disableKeyboardEvents,
      disableSanitizeHtml: getConfig().disableSanitizeHtml,
      nestedRefactorEnabled,
    }),
    [
      options.showHeader,
      options.showTypeIcons,
      options.sortBy,
      options.frozenColumns?.left,
      options.enablePagination,
      options.cellHeight,
      options.maxRowHeight,
      options.disableKeyboardEvents,
      fieldConfig.defaults.noValue,
      nestedRefactorEnabled,
    ]
  );
}
