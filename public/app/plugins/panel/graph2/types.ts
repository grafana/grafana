import { LegendOptions } from '@grafana/ui';

export interface GraphOptions {
  showBars: boolean;
  showLines: boolean;
  showPoints: boolean;
  legend: LegendOptions;
}

export const defaults: GraphOptions = {
  showLines: true,
  showBars: false,
  showPoints: false,
  legend: {
    asTable: false,
    isVisible: false,
    placement: 'under',
  },
};
