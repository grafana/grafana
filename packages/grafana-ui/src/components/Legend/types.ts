import { DataFrameFieldIndex, DisplayValue } from '@grafana/data';
import { LegendList } from './LegendList';
import { LegendTable } from './LegendTable';

export interface LegendBaseProps {
  placement: LegendPlacement;
  className?: string;
  items: LegendItem[];
  itemRenderer?: (item: LegendItem, index: number) => JSX.Element;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onLabelClick?: (item: LegendItem, event: React.MouseEvent<HTMLElement>) => void;
}

export interface LegendTableProps extends LegendBaseProps {
  sortBy?: string;
  sortDesc?: boolean;
  onToggleSort?: (sortBy: string) => void;
}

export interface LegendProps extends LegendBaseProps, LegendTableProps {
  displayMode: LegendDisplayMode;
}

export interface LegendItem {
  label: string;
  color: string;
  yAxis: number;
  disabled?: boolean;
  displayValues?: DisplayValue[];
  fieldIndex?: DataFrameFieldIndex;
}

export enum LegendDisplayMode {
  List = 'list',
  Table = 'table',
  Hidden = 'hidden',
}

export type LegendPlacement = 'bottom' | 'right';

export interface LegendOptions {
  displayMode: LegendDisplayMode;
  placement: LegendPlacement;
}

export type SeriesOptionChangeHandler<TOption> = (label: string, option: TOption) => void;
export type SeriesColorChangeHandler = SeriesOptionChangeHandler<string>;
export type SeriesAxisToggleHandler = SeriesOptionChangeHandler<number>;

export { LegendList, LegendTable };
