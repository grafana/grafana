import { clsx } from 'clsx';
import { memo, MemoExoticComponent } from 'react';

import { Field, FieldType, GrafanaTheme2, isDataFrame, isTimeSeriesFrame } from '@grafana/data';

import { TableCellDisplayMode, TableCellOptions, TableCustomCellOptions } from '../../types';
import { TableCellRenderer, TableCellRendererProps, TableCellStyleOptions, TableCellStyles } from '../types';
import { getCellOptions } from '../utils';

import { ActionsCell, getStyles as getActionsCellStyles } from './ActionsCell';
import { AutoCell, getStyles as getAutoCellStyles, getJsonCellStyles } from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { DataLinksCell, getStyles as getDataLinksStyles } from './DataLinksCell';
import { GeoCell, getStyles as getGeoCellStyles } from './GeoCell';
import { ImageCell, getStyles as getImageStyles } from './ImageCell';
import { MarkdownCell, getStyles as getMarkdownCellStyles } from './MarkdownCell';
import { PillCell, getStyles as getPillStyles } from './PillCell';
import { SparklineCell, getStyles as getSparklineCellStyles } from './SparklineCell';

const AUTO_RENDERER = memo((props: TableCellRendererProps) => (
  <AutoCell value={props.value} field={props.field} rowIdx={props.rowIdx} />
));

function isCustomCellOptions(options: TableCellOptions): options is TableCustomCellOptions {
  return options.type === TableCellDisplayMode.Custom;
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

const CELL_REGISTRY: Record<TableCellOptions['type'], CellRegistryEntry> = {
  [TableCellDisplayMode.Auto]: {
    renderer: AUTO_RENDERER,
    getStyles: getAutoCellStyles,
  },
  [TableCellDisplayMode.ColorBackground]: {
    renderer: AUTO_RENDERER,
    getStyles: getAutoCellStyles,
  },
  [TableCellDisplayMode.ColorText]: {
    renderer: AUTO_RENDERER,
    getStyles: getAutoCellStyles,
  },
  [TableCellDisplayMode.JSONView]: {
    renderer: AUTO_RENDERER,
    getStyles: mixinAutoCellStyles(getJsonCellStyles),
  },
  [TableCellDisplayMode.Actions]: {
    renderer: memo((props: TableCellRendererProps) => (
      <ActionsCell field={props.field} rowIdx={props.rowIdx} getActions={props.getActions ?? (() => [])} />
    )),
    getStyles: getActionsCellStyles,
  },
  [TableCellDisplayMode.DataLinks]: {
    renderer: memo((props: TableCellRendererProps) => <DataLinksCell field={props.field} rowIdx={props.rowIdx} />),
    getStyles: getDataLinksStyles,
  },
  [TableCellDisplayMode.Gauge]: {
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
  },
  [TableCellDisplayMode.Sparkline]: {
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
  },
  [TableCellDisplayMode.Geo]: {
    renderer: memo((props: TableCellRendererProps) => <GeoCell value={props.value} height={props.height} />),
    getStyles: getGeoCellStyles,
  },
  [TableCellDisplayMode.Image]: {
    renderer: memo((props: TableCellRendererProps) => (
      <ImageCell cellOptions={props.cellOptions} field={props.field} value={props.value} rowIdx={props.rowIdx} />
    )),
    getStyles: getImageStyles,
  },
  [TableCellDisplayMode.Pill]: {
    renderer: memo((props: TableCellRendererProps) => (
      <PillCell rowIdx={props.rowIdx} field={props.field} theme={props.theme} />
    )),
    getStyles: getPillStyles,
    testField: (field: Field) => field.type === FieldType.string,
  },
  [TableCellDisplayMode.Markdown]: {
    renderer: memo((props: TableCellRendererProps) => (
      <MarkdownCell field={props.field} rowIdx={props.rowIdx} disableSanitizeHtml={props.disableSanitizeHtml} />
    )),
    getStyles: getMarkdownCellStyles,
    testField: (field: Field) => field.type === FieldType.string,
  },
  [TableCellDisplayMode.Custom]: {
    renderer: memo((props: TableCellRendererProps) => {
      if (!isCustomCellOptions(props.cellOptions) || !props.cellOptions.cellComponent) {
        return null; // nonsensical case, but better to typeguard it than throw.
      }
      const CustomCellComponent = props.cellOptions.cellComponent;
      return (
        <CustomCellComponent field={props.field} rowIndex={props.rowIdx} frame={props.frame} value={props.value} />
      );
    }),
  },
};

/** @internal */
export function getCellRenderer(
  field: Field,
  cellOptions: TableCellOptions = getCellOptions(field)
): TableCellRenderer {
  const cellType = cellOptions?.type ?? TableCellDisplayMode.Auto;
  if (cellType === TableCellDisplayMode.Auto) {
    return CELL_REGISTRY[getAutoRendererDisplayMode(field)].renderer;
  }

  // if the field fails the test for a specific renderer, fallback to Auto
  if (CELL_REGISTRY[cellType]?.testField && CELL_REGISTRY[cellType].testField(field) !== true) {
    return AUTO_RENDERER;
  }

  // cautious fallback to Auto renderer in case some garbage cell type has been provided.
  return CELL_REGISTRY[cellType]?.renderer ?? AUTO_RENDERER;
}

/** @internal */
export function getCellSpecificStyles(
  cellType: TableCellOptions['type'],
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
export function getAutoRendererDisplayMode(field: Field): TableCellOptions['type'] {
  if (field.type === FieldType.geo) {
    return TableCellDisplayMode.Geo;
  }
  if (field.type === FieldType.frame) {
    const firstValue = field.values[0];
    if (isDataFrame(firstValue) && isTimeSeriesFrame(firstValue)) {
      return TableCellDisplayMode.Sparkline;
    }
  }
  return TableCellDisplayMode.Auto;
}
