import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';
import { optsWithHideZeros } from '@grafana/ui/internal';

import { addStandardDataReduceOptions } from '../stat/common';

import { PieChartPanel } from './PieChartPanel';
import { PieChartPanelChangedHandler } from './migrations';
import {
  Options,
  FieldConfig,
  PieChartType,
  PieChartSortOptions,
  PieChartLabels,
  PieChartLegendValues,
} from './panelcfg.gen';
import { PieChartSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options, FieldConfig>(PieChartPanel)
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
    const category = [t('piechart.category-pie-chart', 'Pie chart')];
    const legendCategory = [t('piechart.category-legend', 'Legend')];
    builder
      .addRadio({
        name: t('piechart.name-pie-chart-type', 'Pie chart type'),
        category,
        description: t('piechart.description-pie-chart-type', 'How the pie chart should be rendered'),
        path: 'pieType',
        settings: {
          options: [
            { value: PieChartType.Pie, label: t('piechart.pie-chart-type-options.label-pie', 'Pie') },
            { value: PieChartType.Donut, label: t('piechart.pie-chart-type-options.label-donut', 'Donut') },
          ],
        },
        defaultValue: PieChartType.Pie,
      })
      .addSelect({
        name: 'Slice sorting',
        description: 'Select how to sort the pie slices',
        path: 'pieSorting',
        settings: {
          options: [
            { value: PieChartSortOptions.Descending, label: 'Descending' },
            { value: PieChartSortOptions.Ascending, label: 'Ascending' },
            { value: PieChartSortOptions.None, label: 'None' },
          ],
        },
        defaultValue: PieChartSortOptions.Descending,
      })
      .addMultiSelect({
        name: t('piechart.name-labels', 'Labels'),
        category,
        path: 'displayLabels',
        description: t('piechart.description-labels', 'Select the labels to be displayed in the pie chart'),
        settings: {
          options: [
            { value: PieChartLabels.Percent, label: t('piechart.labels-options.label-percent', 'Percent') },
            { value: PieChartLabels.Name, label: t('piechart.labels-options.label-name', 'Name') },
            { value: PieChartLabels.Value, label: t('piechart.labels-options.label-value', 'Value') },
          ],
        },
      });

    commonOptionsBuilder.addTooltipOptions(builder, false, false, optsWithHideZeros);
    commonOptionsBuilder.addLegendOptions(builder, false);

    builder.addMultiSelect({
      name: t('piechart.name-legend-values', 'Legend values'),
      path: 'legend.values',
      category: legendCategory,
      settings: {
        options: [
          { value: PieChartLegendValues.Percent, label: t('piechart.legend-values-options.label-percent', 'Percent') },
          { value: PieChartLegendValues.Value, label: t('piechart.legend-values-options.label-value', 'Value') },
        ],
      },
      showIf: (c) => c.legend.showLegend !== false,
    });
  })
  .setSuggestionsSupplier(new PieChartSuggestionsSupplier());
