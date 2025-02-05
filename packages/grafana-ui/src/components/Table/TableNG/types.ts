import { Property } from 'csstype';

import { Field, GrafanaTheme2, TimeRange } from '@grafana/data';

export interface CellNGProps {
  value: any;
  field: Field;
  theme: GrafanaTheme2;
  height?: number;
  justifyContent?: Property.JustifyContent;
  rowIdx?: number;
}

export interface RowExpanderNGProps {
  height: number;
  onCellExpand: () => void;
  isExpanded?: boolean;
}

export interface BarGaugeCellProps extends CellNGProps {
  height: number;
  width: number;
  timeRange: TimeRange;
}

export interface SparklineCellProps extends BarGaugeCellProps {}
