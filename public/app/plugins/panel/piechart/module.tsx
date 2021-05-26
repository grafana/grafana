import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { PieChartPanel } from './PieChartPanel';
import { PieChartOptions, PieChartType, PieChartLabels, PieChartLegendValues } from './types';
import { LegendDisplayMode, commonOptionsBuilder } from '@grafana/ui';
import { PieChartPanelChangedHandler } from './migrations';
import { addStandardDataReduceOptions } from '../stat/types';

export const plugin = new PanelPlugin<PieChartOptions>(PieChartPanel)
  .setPanelChangeHandler(PieChartPanelChangedHandler)
  .useFieldConfig({
    disableStandardOptions: [FieldConfigProperty.Thresholds],
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
          bySeriesSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    addStandardDataReduceOptions(builder);
    builder
      .addRadio({
        name: 'Piechart type',
        description: 'How the piechart should be rendered',
        path: 'pieType',
        settings: {
          options: [
            { value: PieChartType.Pie, label: 'Pie' },
            { value: PieChartType.Donut, label: 'Donut' },
          ],
        },
        defaultValue: PieChartType.Pie,
      })
      .addMultiSelect({
        name: 'Labels',
        path: 'displayLabels',
        description: 'Select the labels to be displayed in the pie chart',
        settings: {
          options: [
            { value: PieChartLabels.Percent, label: 'Percent' },
            { value: PieChartLabels.Name, label: 'Name' },
            { value: PieChartLabels.Value, label: 'Value' },
          ],
        },
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder, false);

    builder.addMultiSelect({
      name: 'Legend values',
      path: 'legend.values',
      category: ['Legend'],
      settings: {
        options: [
          { value: PieChartLegendValues.Percent, label: 'Percent' },
          { value: PieChartLegendValues.Value, label: 'Value' },
        ],
      },
      showIf: (c) => c.legend.displayMode !== LegendDisplayMode.Hidden,
    });
  });
