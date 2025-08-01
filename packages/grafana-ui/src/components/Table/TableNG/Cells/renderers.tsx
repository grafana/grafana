import { ReactNode } from 'react';

import { Field, FieldType, isDataFrame, isTimeSeriesFrame } from '@grafana/data';

import { TableCellDisplayMode, TableCellOptions, TableCustomCellOptions } from '../../types';
import { TableCellRendererProps } from '../types';

import { ActionsCell } from './ActionsCell';
import AutoCell from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { DataLinksCell } from './DataLinksCell';
import { GeoCell } from './GeoCell';
import { ImageCell } from './ImageCell';
import { PillCell } from './PillCell';
import { SparklineCell } from './SparklineCell';

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
    justifyContent={props.justifyContent}
    timeRange={props.timeRange}
    rowIdx={props.rowIdx}
    theme={props.theme}
    width={props.width}
  />
);

const GEO_RENDERER: TableCellRenderer = (props) => (
  <GeoCell value={props.value} justifyContent={props.justifyContent} height={props.height} />
);

const IMAGE_RENDERER: TableCellRenderer = (props) => (
  <ImageCell
    cellOptions={props.cellOptions}
    field={props.field}
    height={props.height}
    justifyContent={props.justifyContent}
    value={props.value}
    rowIdx={props.rowIdx}
  />
);

const DATA_LINKS_RENDERER: TableCellRenderer = (props) => <DataLinksCell field={props.field} rowIdx={props.rowIdx} />;

const ACTIONS_RENDERER: TableCellRenderer = ({ field, rowIdx, getActions = () => [] }) => (
  <ActionsCell field={field} rowIdx={rowIdx} getActions={getActions} />
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

const CELL_RENDERERS: Record<TableCellOptions['type'], TableCellRenderer> = {
  [TableCellDisplayMode.Sparkline]: SPARKLINE_RENDERER,
  [TableCellDisplayMode.Gauge]: GAUGE_RENDERER,
  [TableCellDisplayMode.JSONView]: AUTO_RENDERER,
  [TableCellDisplayMode.Image]: IMAGE_RENDERER,
  [TableCellDisplayMode.DataLinks]: DATA_LINKS_RENDERER,
  [TableCellDisplayMode.Actions]: ACTIONS_RENDERER,
  [TableCellDisplayMode.Custom]: CUSTOM_RENDERER,
  [TableCellDisplayMode.ColorText]: AUTO_RENDERER,
  [TableCellDisplayMode.ColorBackground]: AUTO_RENDERER,
  [TableCellDisplayMode.Auto]: AUTO_RENDERER,
  [TableCellDisplayMode.Pill]: PILL_RENDERER,
};

/** @internal */
export function getCellRenderer(field: Field, cellOptions: TableCellOptions): TableCellRenderer {
  const cellType = cellOptions?.type ?? TableCellDisplayMode.Auto;
  if (cellType === TableCellDisplayMode.Auto) {
    return getAutoRendererResult(field);
  }

  // TODO: add support boolean, enum, (maybe int). but for now just string fields
  if (cellType === TableCellDisplayMode.Pill && field.type !== FieldType.string) {
    return AUTO_RENDERER;
  }

  return CELL_RENDERERS[cellType] ?? AUTO_RENDERER;
}

/** @internal */
export function getAutoRendererResult(field: Field): TableCellRenderer {
  if (field.type === FieldType.geo) {
    return GEO_RENDERER;
  }
  if (field.type === FieldType.frame) {
    const firstValue = field.values[0];
    if (isDataFrame(firstValue) && isTimeSeriesFrame(firstValue)) {
      return SPARKLINE_RENDERER;
    }
  }
  return AUTO_RENDERER;
}
