import * as Panel from 'app/types/panel';

export interface PanelOptions extends Panel.MetricPanelOptions {
  layout?: PanelLayout;
  viewMode?: PanelViewMode;
  format?: string;
  nullPointMode?: Panel.NullPointMode;
  valueName?: string;
  prefix?: string;
  postfix?: string;
  tableColumnValue?: string;
  tableColumnLabel?: string;
  // prefixFontSize?: string;
  // valueFontSize?: string;
  // postfixFontSize?: string;
  decimals?: number;
  colorBackground?: boolean;
  colorValue?: boolean;
  sparkline?: {
    show?: boolean;
  };
  thresholds?: ThresholdModel[];
}

export interface PanelSize {
  w: number;
  h: number;
}

// Prefer to use union for typing, because enum requires explicit import, otherwise, you'll get runtime error.
//
// export enum PanelLayout {
//   Horizontal = 'horizontal',
//   Vertical = 'vertical',
// }
export type PanelLayout = 'horizontal' | 'vertical';

export type PanelViewMode = 'stats' | 'bars';

export interface ThresholdModel {
  value: number;
  mode?: ThresholdMode;
  color?: string;
}

export type ThresholdMode = 'ok' | 'warning' | 'critical' | 'custom';
