import type * as React from 'react';
import type { JSX, ReactNode } from 'react';

import { type DataFrameFieldIndex, type DisplayValue } from '@grafana/data';
import { type LegendDisplayMode, type LegendPlacement, type LineStyle } from '@grafana/schema';

import type { PanelContext } from '../PanelChrome';

export enum SeriesVisibilityChangeBehavior {
  Isolate,
  Hide,
}

interface VizLegendBaseProps<T> {
  placement: LegendPlacement;
  className?: string;
  items: Array<VizLegendItem<T>>;
  thresholdItems?: Array<VizLegendItem<T>>;
  mappingItems?: Array<VizLegendItem<T>>;
  seriesVisibilityChangeBehavior?: SeriesVisibilityChangeBehavior;
  itemRenderer?: (item: VizLegendItem<T>, index: number) => JSX.Element;
  readonly?: boolean;
  limit?: number;
  filterAction?: ReactNode;
}

// Label-interaction handlers that VizLegend generates internally (hover -> eventBus,
// click -> series visibility) and forwards to the list/table children. They are not
// part of VizLegend's own public props, so they live on a separate interface.
interface VizLegendHandlersProps<T> {
  onLabelClick?: (item: VizLegendItem<T>, event: React.MouseEvent<HTMLButtonElement>) => void;
  onLabelMouseOver?: (
    item: VizLegendItem,
    event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>
  ) => void;
  onLabelMouseOut?: (
    item: VizLegendItem,
    event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>
  ) => void;
}

interface VizLegendTableSortProps {
  sortBy?: string;
  sortDesc?: boolean;
  isSortable?: boolean;
}

export interface VizLegendListProps<T> extends VizLegendBaseProps<T>, VizLegendHandlersProps<T> {}

export interface VizLegendTableProps<T>
  extends VizLegendBaseProps<T>,
    VizLegendHandlersProps<T>,
    VizLegendTableSortProps {
  onToggleSort?: PanelContext['onToggleLegendSort'];
}

export interface VizLegendProps<T = any> extends VizLegendBaseProps<T>, VizLegendTableSortProps {
  displayMode?: LegendDisplayMode;
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
