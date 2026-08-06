import { useMemo } from 'react';

import { type Field } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import { CELL_HORIZONTAL_CHROME, HEADER_ICON_SPACE, TABLE } from '../constants';
import { type TypographyCtx } from '../types';
import { getDisplayName } from '../utils/fields';
import { buildHeaderHeightMeasurers, getRowHeight } from '../utils/rowHeight';

interface UseHeaderHeightOptions {
  enabled: boolean;
  fields: Field[];
  columnWidths: number[];
  sortColumns: SortColumn[];
  typographyCtx: TypographyCtx;
  showTypeIcons?: boolean;
}

export function useHeaderHeight({
  fields,
  enabled,
  columnWidths,
  sortColumns,
  typographyCtx,
  showTypeIcons = false,
}: UseHeaderHeightOptions): number {
  const measurers = useMemo(() => buildHeaderHeightMeasurers(fields, typographyCtx), [fields, typographyCtx]);

  const columnAvailableWidths = useMemo(
    () =>
      columnWidths.map((c, idx) => {
        if (idx >= fields.length) {
          return 0; // no width available for this column yet
        }

        let width = c - CELL_HORIZONTAL_CHROME;
        const field = fields[idx];

        // filtering icon
        if (field.config?.custom?.filterable) {
          width -= HEADER_ICON_SPACE;
        }
        // sorting icon
        if (sortColumns.some((col) => col.columnKey === getDisplayName(field))) {
          width -= HEADER_ICON_SPACE;
        }
        // type icon
        if (showTypeIcons) {
          width -= HEADER_ICON_SPACE;
        }
        // sadly, the math for this is off by exactly 1 pixel. shrug.
        return Math.floor(width) - 1;
      }),
    [fields, columnWidths, sortColumns, showTypeIcons]
  );

  const headerHeight = useMemo(() => {
    if (!enabled) {
      return 0;
    }
    return getRowHeight(
      fields,
      { __index: -1, __depth: 0 },
      columnAvailableWidths,
      TABLE.HEADER_HEIGHT,
      measurers,
      TABLE.LINE_HEIGHT,
      TABLE.CELL_PADDING
    );
  }, [fields, enabled, columnAvailableWidths, measurers]);

  return headerHeight;
}
