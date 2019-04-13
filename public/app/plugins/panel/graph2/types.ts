import { WithSeriesOptions } from '@grafana/ui';

export type Options = WithSeriesOptions<
  {
    showBars: boolean;
    showLines: boolean;
    showPoints: boolean;
  },
  {
    test: boolean;
  }
>;

export const defaults: Options = {
  showBars: false,
  showLines: true,
  showPoints: false,
  series: {},
};
