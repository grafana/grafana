import { clsx } from 'clsx';
import { memo, MemoExoticComponent } from 'react';

import { Field, FieldType, GrafanaTheme2, isDataFrame, isTimeSeriesFrame } from '@grafana/data';

import { TableCellDisplayMode, TableCellOptions, TableCustomCellOptions } from '../../types';
import {
  RenderableCellTypes,
  TableCellRenderer,
  TableCellRendererProps,
  TableCellStyleOptions,
  TableCellStyles,
} from '../types';
import { getCellOptions } from '../utils';

import { ActionsCell, getStyles as getActionsCellStyles } from './ActionsCell';
import { AutoCell, getStyles as getAutoCellStyles, getJsonCellStyles } from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { DataLinksCell, getStyles as getDataLinksStyles } from './DataLinksCell';
import { GeoCell, getStyles as getGeoCellStyles } from './GeoCell';
import { ImageCell, getStyles as getImageStyles } from './ImageCell';
import { InvalidCell } from './InvalidCell';
import { MarkdownCell, getStyles as getMarkdownCellStyles } from './MarkdownCell';
import { PillCell, getStyles as getPillStyles } from './PillCell';
import { SparklineCell, getStyles as getSparklineCellStyles } from './SparklineCell';

export const AutoCellRenderer = memo((props: TableCellRendererProps) => (
  <AutoCell value={props.value} field={props.field} rowIdx={props.rowIdx} />
));
AutoCellRenderer.displayName = 'AutoCellRenderer';

function isCustomCellOptions(options: TableCellOptions): options is TableCustomCellOptions {
  return options.type === TableCellDisplayMode.Custom;
}

const PRIMITIVE_TYPES: FieldType[] = [
  FieldType.time,
  FieldType.number,
  FieldType.boolean,
  FieldType.string,
  FieldType.enum,
];
const AUTO_CELL_TYPES: FieldType[] = [...PRIMITIVE_TYPES, FieldType.other];
function canAutoCellRender(field: Field): boolean {
  return AUTO_CELL_TYPES.includes(field.type);
}

function mixinAutoCellStyles(fn: TableCellStyles): TableCellStyles {
  return (theme, options) => {
    const styles = fn(theme, options);
    return clsx(styles, getAutoCellStyles(theme, options));
  };
}

interface CellRegistryEntry {
  renderer: MemoExoticComponent<TableCellRenderer>;
  getStyles?: TableCellStyles;
  testField?: (field: Field) => boolean;
}

const InvalidCellRenderer: TableCellRenderer = memo((props) => (
  <InvalidCell field={props.field} cellOptions={props.cellOptions} />
));
InvalidCellRenderer.displayName = 'InvalidCellRenderer';

const CELL_REGISTRY: Record<RenderableCellTypes, CellRegistryEntry> = {
  [TableCellDisplayMode.Auto]: {
    renderer: AutoCellRenderer,
    getStyles: getAutoCellStyles,
    testField: canAutoCellRender,
  },
  [TableCellDisplayMode.ColorBackground]: {
    renderer: AutoCellRenderer,
    getStyles: getAutoCellStyles,
    testField: canAutoCellRender,
  },
  [TableCellDisplayMode.ColorText]: {
    renderer: AutoCellRenderer,
    getStyles: getAutoCellStyles,
    testField: canAutoCellRender,
  },
  [TableCellDisplayMode.JSONView]: {
    renderer: AutoCellRenderer,
    getStyles: mixinAutoCellStyles(getJsonCellStyles),
    testField: canAutoCellRender,
  },
  [TableCellDisplayMode.Actions]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => (
      <ActionsCell field={props.field} rowIdx={props.rowIdx} getActions={props.getActions ?? (() => [])} />
    )),
    getStyles: getActionsCellStyles,
  },
  [TableCellDisplayMode.DataLinks]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => <DataLinksCell field={props.field} rowIdx={props.rowIdx} />),
    getStyles: getDataLinksStyles,
  },
  [TableCellDisplayMode.Gauge]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => (
      <BarGaugeCell
        field={props.field}
        value={props.value}
        theme={props.theme}
        height={props.height}
        width={props.width}
        rowIdx={props.rowIdx}
      />
    )),
    testField: (field: Field) => field.type === FieldType.number,
  },
  [TableCellDisplayMode.Sparkline]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => (
      <SparklineCell
        value={props.value}
        field={props.field}
        timeRange={props.timeRange}
        rowIdx={props.rowIdx}
        theme={props.theme}
        width={props.width}
      />
    )),
    getStyles: getSparklineCellStyles,
    testField: (field: Field) => {
      const firstNonNullValue = field.values.find((v) => v != null);
      return firstNonNullValue != null && isDataFrame(firstNonNullValue) && isTimeSeriesFrame(firstNonNullValue);
    },
  },
  [TableCellDisplayMode.Geo]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => <GeoCell value={props.value} height={props.height} />),
    getStyles: getGeoCellStyles,
    testField: (field: Field) => field.type === FieldType.geo,
  },
  [TableCellDisplayMode.Image]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => (
      <ImageCell cellOptions={props.cellOptions} field={props.field} value={props.value} rowIdx={props.rowIdx} />
    )),
    getStyles: getImageStyles,
    testField: (field: Field) => field.type === FieldType.string || field.type === FieldType.enum,
  },
  [TableCellDisplayMode.Pill]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => (
      <PillCell
        rowIdx={props.rowIdx}
        field={props.field}
        theme={props.theme}
        getTextColorForBackground={props.getTextColorForBackground}
      />
    )),
    getStyles: getPillStyles,
    testField: (field: Field) => {
      if (PRIMITIVE_TYPES.includes(field.type)) {
        return true;
      }
      if (field.type === FieldType.other) {
        const firstNonNullValue = field.values.find((v) => v != null);
        return Array.isArray(firstNonNullValue);
      }
      return false;
    },
  },
  [TableCellDisplayMode.Markdown]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => (
      <MarkdownCell field={props.field} rowIdx={props.rowIdx} disableSanitizeHtml={props.disableSanitizeHtml} />
    )),
    getStyles: getMarkdownCellStyles,
    testField: (field: Field) => PRIMITIVE_TYPES.includes(field.type),
  },
  [TableCellDisplayMode.Custom]: {
    // eslint-disable-next-line react/display-name
    renderer: memo((props: TableCellRendererProps) => {
      if (!isCustomCellOptions(props.cellOptions) || !props.cellOptions.cellComponent) {
        return null; // nonsensical case, but better to typeguard it than throw.
      }
      const CustomCellComponent = props.cellOptions.cellComponent;
      return (
        <CustomCellComponent field={props.field} rowIndex={props.rowIdx} frame={props.frame} value={props.value} />
      );
    }),
    testField: (field) => {
      const cellOptions = getCellOptions(field);
      return !isCustomCellOptions(cellOptions) || !cellOptions.cellComponent;
    },
  },
};

/** @internal */
export function getCellRenderer(
  field: Field,
  cellOptions: TableCellOptions = getCellOptions(field)
): TableCellRenderer {
  const cellType = cellOptions?.type ?? TableCellDisplayMode.Auto;
  const displayMode = cellType === TableCellDisplayMode.Auto ? getAutoRendererDisplayMode(field) : cellType;
  const candidate = CELL_REGISTRY[displayMode];

  // if the field fails the test for a specific renderer, return the Invalid renderer
  if ((candidate?.testField?.(field) ?? true) !== true) {
    return InvalidCellRenderer;
  }

  // cautious fallback to Auto renderer in case some garbage cell type has been provided.
  return candidate?.renderer ?? AutoCellRenderer;
}

/** @internal */
export function getCellSpecificStyles(
  cellType: RenderableCellTypes,
  field: Field,
  theme: GrafanaTheme2,
  options: TableCellStyleOptions
): string | undefined {
  if (cellType === TableCellDisplayMode.Auto) {
    return getAutoRendererStyles(theme, options, field);
  }
  return CELL_REGISTRY[cellType]?.getStyles?.(theme, options);
}

/** @internal */
export function getAutoRendererStyles(
  theme: GrafanaTheme2,
  options: TableCellStyleOptions,
  field: Field
): string | undefined {
  const impliedDisplayMode = getAutoRendererDisplayMode(field);
  if (impliedDisplayMode !== TableCellDisplayMode.Auto) {
    return CELL_REGISTRY[impliedDisplayMode]?.getStyles?.(theme, options);
  }
  return getAutoCellStyles(theme, options);
}

/** @internal */
export function getAutoRendererDisplayMode(field: Field): RenderableCellTypes {
  if (field.type === FieldType.geo) {
    return TableCellDisplayMode.Geo;
  }
  if (field.type === FieldType.frame) {
    return TableCellDisplayMode.Sparkline;
  }
  return TableCellDisplayMode.Auto;
}
