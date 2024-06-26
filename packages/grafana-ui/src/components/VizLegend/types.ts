import * as React from 'react';

import { DataFrameFieldIndex, DisplayValue } from '@grafana/data';
import { LegendDisplayMode, LegendPlacement, LineStyle } from '@grafana/schema';

// JEV: REFACTOR: explicitly defined the values here
export enum SeriesVisibilityChangeBehavior {
  Isolate,
  Hide,
}

export interface VizLegendBaseProps<T> {
  placement: LegendPlacement;
  className?: string;
  items: Array<VizLegendItem<T>>;
  seriesVisibilityChangeBehavior?: SeriesVisibilityChangeBehavior;
  onLabelClick?: (item: VizLegendItem<T>, event: React.MouseEvent<HTMLButtonElement>) => void;
  itemRenderer?: (item: VizLegendItem<T>, index: number) => JSX.Element;
  onLabelMouseOver?: (
    item: VizLegendItem,
    event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>
  ) => void;
  onLabelMouseOut?: (
    item: VizLegendItem,
    event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>
  ) => void;
  readonly?: boolean;
}

export interface VizLegendTableProps<T> extends VizLegendBaseProps<T> {
  sortBy?: string;
  sortDesc?: boolean;
  onToggleSort?: (sortBy: string) => void;
  isSortable?: boolean;
}

export interface LegendProps<T = any> extends VizLegendBaseProps<T>, VizLegendTableProps<T> {
  displayMode: LegendDisplayMode;
}

export interface VizLegendItem<T = any> {
  getItemKey?: () => string;
  label: string;
  color?: string;
  gradient?: string;
  yAxis: number;
  disabled?: boolean;
  // displayValues?: DisplayValue[];
  getDisplayValues?: () => DisplayValue[];
  fieldIndex?: DataFrameFieldIndex;
  fieldName?: string;
  data?: T;
  lineStyle?: LineStyle;
}
