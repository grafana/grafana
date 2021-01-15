import { VizOrientation } from '@grafana/data';

export enum BarStackingMode {
  None = 'none',
  Standard = 'standard',
  Percent = 'percent',
}

export enum ValueVisibility {
  Auto = 'auto',
  Never = 'never',
  Always = 'always',
}

export interface BarChartOptions {
  orientation: VizOrientation;
  stacking: BarStackingMode;
  showValue: ValueVisibility;
}

export const defaults: BarChartOptions = {
  orientation: VizOrientation.Auto,
  stacking: BarStackingMode.None,
  showValue: ValueVisibility.Auto,
};
