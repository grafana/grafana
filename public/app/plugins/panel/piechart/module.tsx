import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { addStandardDataReduceOptions } from '../stat/common';

import { PieChartPanel } from './PieChartPanel';
import { PieChartPanelChangedHandler } from './migrations';
import { PanelOptions, PanelFieldConfig, PieChartType, PieChartLabels, PieChartLegendValues } from './models.gen';
import { PieChartSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(PieChartPanel)
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
      showIf: (c) => c.legend.showLegend !== false,
    });
  })
  .setSuggestionsSupplier(new PieChartSuggestionsSupplier());
