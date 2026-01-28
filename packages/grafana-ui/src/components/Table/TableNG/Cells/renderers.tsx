import { clsx } from 'clsx';
import { memo, MemoExoticComponent, NamedExoticComponent } from 'react';

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

const wrapComponentInMemo = <P extends object>(fn: React.FunctionComponent<P>, name: string) => {
  const result = memo<P>(fn);
  result.displayName = name;
  return result;
};

export const AutoCellRenderer = wrapComponentInMemo(
  (props: TableCellRendererProps) => <AutoCell value={props.value} field={props.field} rowIdx={props.rowIdx} />,
  'AutoCellRenderer'
);

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
  renderer: MemoExoticComponent<TableCellRenderer> | NamedExoticComponent<TableCellRendererProps>;
  getStyles?: TableCellStyles;
  testField?: (field: Field) => boolean;
}

const CELL_REGISTRY: Record<TableCellOptions['type'], CellRegistryEntry> = {
  [TableCellDisplayMode.Auto]: {
    renderer: AutoCellRenderer,
    getStyles: getAutoCellStyles,
  },
  [TableCellDisplayMode.ColorBackground]: {
    renderer: AutoCellRenderer,
    getStyles: getAutoCellStyles,
  },
  [TableCellDisplayMode.ColorText]: {
    renderer: AutoCellRenderer,
    getStyles: getAutoCellStyles,
  },
  [TableCellDisplayMode.JSONView]: {
    renderer: AutoCellRenderer,
    getStyles: mixinAutoCellStyles(getJsonCellStyles),
  },
  [TableCellDisplayMode.Actions]: {
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => (
        <ActionsCell field={props.field} rowIdx={props.rowIdx} getActions={props.getActions ?? (() => [])} />
      ),
      'ActionsCellRenderer'
    ),
    getStyles: getActionsCellStyles,
  },
  [TableCellDisplayMode.DataLinks]: {
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => <DataLinksCell field={props.field} rowIdx={props.rowIdx} />,
      'DataLinksCellRenderer'
    ),
    getStyles: getDataLinksStyles,
  },
  [TableCellDisplayMode.Gauge]: {
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => (
        <BarGaugeCell
          field={props.field}
          value={props.value}
          theme={props.theme}
          height={props.height}
          width={props.width}
          rowIdx={props.rowIdx}
        />
      ),
      'BarGaugeCellRenderer'
    ),
  },
  [TableCellDisplayMode.Sparkline]: {
    // eslint-disable-next-line react/display-name
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => (
        <SparklineCell
          value={props.value}
          field={props.field}
          timeRange={props.timeRange}
          rowIdx={props.rowIdx}
          theme={props.theme}
          width={props.width}
        />
      ),
      'SparklineCellRenderer'
    ),
    getStyles: getSparklineCellStyles,
  },
  [TableCellDisplayMode.Geo]: {
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => <GeoCell value={props.value} height={props.height} />,
      'GeoCellRenderer'
    ),
    getStyles: getGeoCellStyles,
  },
  [TableCellDisplayMode.Image]: {
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => (
        <ImageCell cellOptions={props.cellOptions} field={props.field} value={props.value} rowIdx={props.rowIdx} />
      ),
      'ImageCellRenderer'
    ),
    getStyles: getImageStyles,
  },
  [TableCellDisplayMode.Pill]: {
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => (
        <PillCell
          rowIdx={props.rowIdx}
          field={props.field}
          theme={props.theme}
          getTextColorForBackground={props.getTextColorForBackground}
        />
      ),
      'PillCellRenderer'
    ),
    getStyles: getPillStyles,
    testField: (field: Field) =>
      field.type === FieldType.string ||
      (field.type === FieldType.other && field.values.some((val) => Array.isArray(val))),
  },
  [TableCellDisplayMode.Markdown]: {
    renderer: wrapComponentInMemo(
      (props: TableCellRendererProps) => (
        <MarkdownCell field={props.field} rowIdx={props.rowIdx} disableSanitizeHtml={props.disableSanitizeHtml} />
      ),
      'MarkdownCellRenderer'
    ),
    getStyles: getMarkdownCellStyles,
    testField: (field: Field) => field.type === FieldType.string,
  },
  [TableCellDisplayMode.Custom]: {
    renderer: wrapComponentInMemo((props: TableCellRendererProps) => {
      if (!isCustomCellOptions(props.cellOptions) || !props.cellOptions.cellComponent) {
        return null; // nonsensical case, but better to typeguard it than throw.
      }
      const CustomCellComponent = props.cellOptions.cellComponent;
      return (
        <CustomCellComponent field={props.field} rowIndex={props.rowIdx} frame={props.frame} value={props.value} />
      );
    }, 'CustomCellRenderer'),
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
    return AutoCellRenderer;
  }

  // cautious fallback to Auto renderer in case some garbage cell type has been provided.
  return CELL_REGISTRY[cellType]?.renderer ?? AutoCellRenderer;
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
