import { PanelPlugin } from '@grafana/data';
import { PieChartPanel } from './PieChartPanel';
import { PieChartOptions } from './types';
import { addStandardDataReduceOptions } from '../stat/types';
import { PieChartType } from '@grafana/ui';

export const plugin = new PanelPlugin<PieChartOptions>(PieChartPanel).setPanelOptions(builder => {
  addStandardDataReduceOptions(builder, false);

  builder
    .addRadio({
      name: 'Piechart type',
      description: 'How the piechart should be rendered',
      path: 'pieType',
      settings: {
        options: [
          { value: PieChartType.PIE, label: 'Pie' },
          { value: PieChartType.DONUT, label: 'Donut' },
        ],
      },
      defaultValue: PieChartType.PIE,
    })
    .addNumberInput({
      name: 'Width',
      description: 'Width of the piechart outline',
      path: 'strokeWidth',
      defaultValue: 1,
    });
});
