import { LegendOptions } from '@grafana/ui';

export interface Options {
  showBars: boolean;
  showLines: boolean;
  showPoints: boolean;
  legend?: LegendOptions;
}

export const defaults: Options = {
  showBars: false,
  showLines: true,
  showPoints: false,
};
