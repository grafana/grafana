import { DataFrameFieldIndex, DisplayValue } from '@grafana/data';
import React from 'react';
import { LegendDisplayMode, LegendPlacement } from './models.gen';

export enum SeriesVisibilityChangeBehavior {
  Isolate,
  Hide,
}

export interface VizLegendBaseProps {
  placement: LegendPlacement;
  className?: string;
  items: VizLegendItem[];
  seriesVisibilityChangeBehavior?: SeriesVisibilityChangeBehavior;
  onLabelClick?: (item: VizLegendItem, event: React.MouseEvent<HTMLElement>) => void;
  itemRenderer?: (item: VizLegendItem, index: number) => JSX.Element;
  onLabelMouseEnter?: (item: VizLegendItem, event: React.MouseEvent<HTMLElement>) => void;
  onLabelMouseOut?: (item: VizLegendItem, event: React.MouseEvent<HTMLElement>) => void;
}

export interface VizLegendTableProps extends VizLegendBaseProps {
  sortBy?: string;
  sortDesc?: boolean;
  onToggleSort?: (sortBy: string) => void;
}

export interface LegendProps extends VizLegendBaseProps, VizLegendTableProps {
  displayMode: LegendDisplayMode;
}

export interface VizLegendItem {
  getItemKey?: () => string;
  label: string;
  color: string;
  yAxis: number;
  disabled?: boolean;
  // displayValues?: DisplayValue[];
  getDisplayValues?: () => DisplayValue[];
  fieldIndex?: DataFrameFieldIndex;
}
