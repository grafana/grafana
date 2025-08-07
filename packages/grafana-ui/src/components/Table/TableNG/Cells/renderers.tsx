import { clsx } from 'clsx';
import { ReactNode } from 'react';

import { Field, FieldType, GrafanaTheme2, isDataFrame, isTimeSeriesFrame } from '@grafana/data';

import { TableCellDisplayMode, TableCellOptions, TableCustomCellOptions } from '../../types';
import { TableCellRendererProps, TableCellStyleOptions, TableCellStyles } from '../types';

import { ActionsCell, getStyles as getActionsCellStyles } from './ActionsCell';
import { AutoCell, getStyles as getAutoCellStyles, getColorCellStyles, getJsonCellStyles } from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { DataLinksCell, getStyles as getDataLinksStyles } from './DataLinksCell';
import { GeoCell, getStyles as getGeoCellStyles } from './GeoCell';
import { ImageCell, getStyles as getImageStyles } from './ImageCell';
import { MarkdownCell, getStyles as getMarkdownCellStyles } from './MarkdownCell';
import { PillCell, getStyles as getPillStyles } from './PillCell';
import { SparklineCell, getStyles as getSparklineCellStyles } from './SparklineCell';

export type TableCellRenderer = (props: TableCellRendererProps) => ReactNode;

const GAUGE_RENDERER: TableCellRenderer = (props) => (
  <BarGaugeCell
    field={props.field}
    value={props.value}
    theme={props.theme}
    height={props.height}
    width={props.width}
    rowIdx={props.rowIdx}
  />
);

const AUTO_RENDERER: TableCellRenderer = (props) => (
  <AutoCell value={props.value} field={props.field} rowIdx={props.rowIdx} />
);

const SPARKLINE_RENDERER: TableCellRenderer = (props) => (
  <SparklineCell
    value={props.value}
    field={props.field}
    timeRange={props.timeRange}
    rowIdx={props.rowIdx}
    theme={props.theme}
    width={props.width}
  />
);

const GEO_RENDERER: TableCellRenderer = (props) => <GeoCell value={props.value} height={props.height} />;

const IMAGE_RENDERER: TableCellRenderer = (props) => (
  <ImageCell cellOptions={props.cellOptions} field={props.field} value={props.value} rowIdx={props.rowIdx} />
);

const DATA_LINKS_RENDERER: TableCellRenderer = (props) => <DataLinksCell field={props.field} rowIdx={props.rowIdx} />;

const ACTIONS_RENDERER: TableCellRenderer = ({ field, rowIdx, getActions = () => [] }) => (
  <ActionsCell field={field} rowIdx={rowIdx} getActions={getActions} />
);

const MARKDOWN_RENDERER: TableCellRenderer = (props) => (
  <MarkdownCell field={props.field} rowIdx={props.rowIdx} disableSanitizeHtml={props.disableSanitizeHtml} />
);

const PILL_RENDERER: TableCellRenderer = (props) => <PillCell {...props} />;

function isCustomCellOptions(options: TableCellOptions): options is TableCustomCellOptions {
  return options.type === TableCellDisplayMode.Custom;
}

const CUSTOM_RENDERER: TableCellRenderer = (props) => {
  if (!isCustomCellOptions(props.cellOptions) || !props.cellOptions.cellComponent) {
    return null; // nonsensical case, but better to typeguard it than throw.
  }
  const CustomCellComponent = props.cellOptions.cellComponent;
  return <CustomCellComponent field={props.field} rowIndex={props.rowIdx} frame={props.frame} value={props.value} />;
};

const CELL_RENDERERS: Record<TableCellOptions['type'], { renderer: TableCellRenderer; getStyles?: TableCellStyles }> = {
  [TableCellDisplayMode.Actions]: {
    renderer: ACTIONS_RENDERER,
    getStyles: getActionsCellStyles,
  },
  [TableCellDisplayMode.Auto]: {
    renderer: AUTO_RENDERER,
    getStyles: getAutoCellStyles,
  },
  [TableCellDisplayMode.ColorBackground]: {
    renderer: AUTO_RENDERER,
    getStyles: (theme, opts) => clsx(getAutoCellStyles(theme, opts), getColorCellStyles(theme, opts)),
  },
  [TableCellDisplayMode.ColorText]: {
    renderer: AUTO_RENDERER,
    getStyles: (theme, opts) => clsx(getAutoCellStyles(theme, opts), getColorCellStyles(theme, opts)),
  },
  [TableCellDisplayMode.Custom]: {
    renderer: CUSTOM_RENDERER,
  },
  [TableCellDisplayMode.DataLinks]: {
    renderer: DATA_LINKS_RENDERER,
    getStyles: getDataLinksStyles,
  },
  [TableCellDisplayMode.Gauge]: {
    renderer: GAUGE_RENDERER,
  },
  [TableCellDisplayMode.Geo]: {
    renderer: GEO_RENDERER,
    getStyles: getGeoCellStyles,
  },
  [TableCellDisplayMode.Image]: {
    renderer: IMAGE_RENDERER,
    getStyles: getImageStyles,
  },
  [TableCellDisplayMode.JSONView]: {
    renderer: AUTO_RENDERER,
    getStyles: (theme, opts) => clsx(getAutoCellStyles(theme, opts), getJsonCellStyles(theme, opts)),
  },
  [TableCellDisplayMode.Pill]: {
    renderer: PILL_RENDERER,
    getStyles: getPillStyles,
  },
  [TableCellDisplayMode.Sparkline]: {
    renderer: SPARKLINE_RENDERER,
    getStyles: getSparklineCellStyles,
  },
  [TableCellDisplayMode.Markdown]: {
    renderer: MARKDOWN_RENDERER,
    getStyles: getMarkdownCellStyles,
  },
};

// TODO: come up with a more elegant way to handle this.
const STRING_ONLY_RENDERERS = new Set<TableCellOptions['type']>([
  TableCellDisplayMode.Markdown,
  TableCellDisplayMode.Pill,
]);

/** @internal */
export function getCellRenderer(field: Field, cellOptions: TableCellOptions): TableCellRenderer {
  const cellType = cellOptions?.type ?? TableCellDisplayMode.Auto;
  if (cellType === TableCellDisplayMode.Auto) {
    return CELL_RENDERERS[getAutoRendererDisplayMode(field)].renderer;
  }

  if (STRING_ONLY_RENDERERS.has(cellType) && field.type !== FieldType.string) {
    return AUTO_RENDERER;
  }

  // cautious fallback to Auto renderer in case some garbage cell type has been provided.
  return CELL_RENDERERS[cellType]?.renderer ?? AUTO_RENDERER;
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
  return CELL_RENDERERS[cellType]?.getStyles?.(theme, options);
}

/** @internal */
export function getAutoRendererStyles(
  theme: GrafanaTheme2,
  options: TableCellStyleOptions,
  field: Field
): string | undefined {
  const impliedDisplayMode = getAutoRendererDisplayMode(field);
  if (impliedDisplayMode !== TableCellDisplayMode.Auto) {
    return CELL_RENDERERS[impliedDisplayMode]?.getStyles?.(theme, options);
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
