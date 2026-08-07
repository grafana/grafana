import { FieldType, type Field } from '@grafana/data';
import {
  BarGaugeDisplayMode,
  type FieldTextAlignment,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
} from '@grafana/schema';

import { type TableCellOptions } from '../../types';
import { type TextAlign } from '../styles';
import { type ColumnTypes } from '../types';

/**
 * @internal
 * returns the display name of a field
 * returns the display name of a field.
 * We intentionally do not want to use @grafana/data's getFieldDisplayName here,
 * instead we have a call to cacheFieldDisplayNames up in TablePanel to handle this
 * before we begin.
 */
export const getDisplayName = (field: Field): string => {
  return field.state?.displayName ?? field.name;
};

/**
 * @internal given a field name or display name, returns a predicate function that checks if a field matches that name.
 */
export const predicateByName = (name: string) => (f: Field) => f.name === name || getDisplayName(f) === name;

/**
 * @internal
 * returns only fields that are not nested tables and not explicitly hidden
 */
export function getVisibleFields(fields: Field[]): Field[] {
  return fields.filter((field) => field.type !== FieldType.nestedFrames && field.config.custom?.hideFrom?.viz !== true);
}

/**
 * @internal
 * returns a map of column types by display name
 */
export function getColumnTypes(fields: Field[]): ColumnTypes {
  return fields.reduce<ColumnTypes>((acc, field) => {
    switch (field.type) {
      case FieldType.nestedFrames:
        return { ...acc, ...getColumnTypes(field.values[0]?.[0]?.fields ?? []) };
      default:
        return { ...acc, [getDisplayName(field)]: field.type };
    }
  }, {});
}

/**
 * @internal
 * Extracts numeric pixel value from theme spacing
 */
export const extractPixelValue = (spacing: string | number): number => {
  return typeof spacing === 'number' ? spacing : parseFloat(spacing) || 0;
};

const DEFAULT_CELL_OPTIONS = { type: TableCellDisplayMode.Auto } as const;

/**
 * @internal
 * Returns the cell options for a field, migrating from legacy displayMode if necessary.
 * TODO: remove live migration in favor of doing it in dashboard or panel migrator
 */
export function getCellOptions(field: Field): TableCellOptions {
  if (field.config.custom?.displayMode) {
    return migrateTableDisplayModeToCellOptions(field.config.custom?.displayMode);
  }

  return field.config.custom?.cellOptions ?? DEFAULT_CELL_OPTIONS;
}

type TableCellGaugeDisplayModes =
  | TableCellDisplayMode.BasicGauge
  | TableCellDisplayMode.GradientGauge
  | TableCellDisplayMode.LcdGauge;
const TABLE_CELL_GAUGE_DISPLAY_MODES_TO_DISPLAY_MODES: Record<TableCellGaugeDisplayModes, BarGaugeDisplayMode> = {
  [TableCellDisplayMode.BasicGauge]: BarGaugeDisplayMode.Basic,
  [TableCellDisplayMode.GradientGauge]: BarGaugeDisplayMode.Gradient,
  [TableCellDisplayMode.LcdGauge]: BarGaugeDisplayMode.Lcd,
};

type TableCellColorBackgroundDisplayModes =
  | TableCellDisplayMode.ColorBackground
  | TableCellDisplayMode.ColorBackgroundSolid;
const TABLE_CELL_COLOR_BACKGROUND_DISPLAY_MODES_TO_DISPLAY_MODES: Record<
  TableCellColorBackgroundDisplayModes,
  TableCellBackgroundDisplayMode
> = {
  [TableCellDisplayMode.ColorBackground]: TableCellBackgroundDisplayMode.Gradient,
  [TableCellDisplayMode.ColorBackgroundSolid]: TableCellBackgroundDisplayMode.Basic,
};

/**
 * Migrates table cell display mode to new object format.
 *
 * @param displayMode The display mode of the cell
 * @returns TableCellOptions object in the correct format
 * relative to the old display mode.
 */
export function migrateTableDisplayModeToCellOptions(displayMode: TableCellDisplayMode): TableCellOptions {
  switch (displayMode) {
    // In the case of the gauge we move to a different option
    case TableCellDisplayMode.BasicGauge:
    case TableCellDisplayMode.GradientGauge:
    case TableCellDisplayMode.LcdGauge:
      return {
        type: TableCellDisplayMode.Gauge,
        mode: TABLE_CELL_GAUGE_DISPLAY_MODES_TO_DISPLAY_MODES[displayMode],
      };
    // Also true in the case of the color background
    case TableCellDisplayMode.ColorBackground:
    case TableCellDisplayMode.ColorBackgroundSolid:
      return {
        type: TableCellDisplayMode.ColorBackground,
        mode: TABLE_CELL_COLOR_BACKGROUND_DISPLAY_MODES_TO_DISPLAY_MODES[displayMode],
      };
    // catching a nonsense case: `displayMode`: 'custom' should pre-date the CustomCell.
    // if it doesn't, we need to just nope out and return an auto cell.
    case TableCellDisplayMode.Custom:
      return {
        type: TableCellDisplayMode.Auto,
      };
    default:
      return {
        type: displayMode,
      };
  }
}

/**
 * @internal
 * Returns true if cell inspection (hover to see full content) is enabled for the field.
 */
export function isCellInspectEnabled(field: Field): boolean {
  return field.config?.custom?.inspect ?? false;
}

/**
 * @internal
 * Returns true if text wrapping should be applied to the cell.
 */
export function shouldTextWrap(field: Field): boolean {
  return Boolean(field.config.custom?.wrapText);
}

/**
 * @internal
 * Returns true if text overflow handling should be applied to the cell.
 */
export function shouldTextOverflow(field: Field): boolean {
  const cellOptions = getCellOptions(field);
  const eligibleCellType =
    // Tech debt: Technically image cells are of type string, which is misleading (kinda?)
    // so we need to ensurefield.type === FieldType.string we don't apply overflow hover states for type image
    (field.type === FieldType.string && cellOptions.type !== TableCellDisplayMode.Image) ||
    // regardless of the underlying cell type, data links cells have text overflow.
    cellOptions.type === TableCellDisplayMode.DataLinks;

  return eligibleCellType && !shouldTextWrap(field) && !isCellInspectEnabled(field);
}

// we only want to infer justifyContent and textAlign for these cellTypes
const TEXT_CELL_TYPES = new Set<TableCellDisplayMode>([
  TableCellDisplayMode.Auto,
  TableCellDisplayMode.ColorText,
  TableCellDisplayMode.ColorBackground,
]);

/**
 * @internal
 * Returns the text-align value for inline-displayed cells for a field based on its type and configuration.
 */
export function getAlignment(field: Field): TextAlign {
  const align: FieldTextAlignment | undefined = field.config.custom?.align;

  if (!align || align === 'auto') {
    if (TEXT_CELL_TYPES.has(getCellOptions(field).type) && field.type === FieldType.number) {
      return 'right';
    }
    return 'left';
  }

  return align;
}

export function getSummaryCellTextAlign(textAlign: TextAlign, cellType: TableCellDisplayMode): TextAlign {
  // gauge is weird. left-aligned gauge has the viz on the left and its numbers on the right, and vice-versa.
  // if you center-aligned your gauge... ok.
  if (cellType === TableCellDisplayMode.Gauge) {
    return (
      {
        left: 'right',
        right: 'left',
        center: 'center',
      } as const
    )[textAlign];
  }

  return textAlign;
}
