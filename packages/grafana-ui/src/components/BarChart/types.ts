import { VizOrientation } from '@grafana/data';

export enum BarStackingMode {
  None = 'none',
  Standard = 'standard',
  Percent = 'percent',
}

export enum BarValueVisibility {
  Auto = 'auto',
  Never = 'never',
  Always = 'always',
}

export interface BarChartOptions {
  orientation: VizOrientation;
  stacking: BarStackingMode;
  showValue: BarValueVisibility;
}
