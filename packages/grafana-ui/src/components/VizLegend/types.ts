import { DataFrameFieldIndex, DisplayValue } from '@grafana/data';
import { LegendDisplayMode, LegendPlacement } from './models.gen';

export interface VizLegendBaseProps<T = {}> {
  placement: LegendPlacement;
  className?: string;
  items: Array<VizLegendItem<T>>;
  itemRenderer?: (item: VizLegendItem<T>, index: number) => JSX.Element;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onLabelClick?: (item: VizLegendItem<T>, event: React.MouseEvent<HTMLElement>) => void;
}

export interface VizLegendTableProps<T = {}> extends VizLegendBaseProps<T> {
  sortBy?: string;
  sortDesc?: boolean;
  onToggleSort?: (sortBy: string) => void;
}

export interface LegendProps<T> extends VizLegendBaseProps<T>, VizLegendTableProps<T> {
  displayMode: LegendDisplayMode;
}

export interface VizLegendItem<T = {}> {
  getItemKey?: () => string;
  label: string;
  color: string;
  yAxis: number;
  disabled?: boolean;
  // displayValues?: DisplayValue[];
  getDisplayValues?: () => DisplayValue[];
  fieldIndex?: DataFrameFieldIndex;
  data?: T;
}

export type SeriesOptionChangeHandler<TOption> = (label: string, option: TOption) => void;
export type SeriesColorChangeHandler = SeriesOptionChangeHandler<string>;
