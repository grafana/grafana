import { VizOrientation } from '@grafana/data';
import { AxisConfig } from '../uPlot/config';

/**
 * @alpha
 */
export enum BarStackingMode {
  None = 'none',
  Standard = 'standard',
  Percent = 'percent',
}

/**
 * @alpha
 */
export enum BarValueVisibility {
  Auto = 'auto',
  Never = 'never',
  Always = 'always',
}

/**
 * @alpha
 */
export interface BarChartOptions {
  orientation: VizOrientation;
  stacking: BarStackingMode;
  showValue: BarValueVisibility;
}

/**
 * @alpha
 */
export interface BarChartFieldConfig extends AxisConfig {
  lineWidth?: number; // 0
  fillOpacity?: number; // 100
}
