import { Property } from 'csstype';

import { ActionModel, Field, GrafanaTheme2, TimeRange } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';

export interface CellNGProps {
  value: any;
  field: Field;
  theme?: GrafanaTheme2;
  height?: number;
  justifyContent: Property.JustifyContent;
  rowIdx?: number;
  actions?: ActionModel[];
}

export interface RowExpanderNGProps {
  height: number;
  onCellExpand: () => void;
  isExpanded?: boolean;
}

export interface BarGaugeCellProps extends CellNGProps {
  height: number;
  theme: GrafanaTheme2;
  timeRange: TimeRange;
  width: number;
}

export interface ImageCellProps extends CellNGProps {
  cellOptions: TableCellOptions;
  height: number;
}

export interface SparklineCellProps extends BarGaugeCellProps {}

export interface CellColors {
  textColor?: string;
  bgColor?: string;
  bgHoverColor?: string;
}

export type TableRow = Record<string, unknown>;
