import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SortOrder } from '@grafana/schema';
import { optsWithHideZeros } from '@grafana/ui/internal';
import { commonOptionsBuilder } from '@grafana/ui/options';

import { addStandardDataReduceOptions } from '../stat/common';

import { PieChartPanel } from './PieChartPanel';
import { PieChartPanelChangedHandler } from './migrations';
import { type Options, type FieldConfig, PieChartType, PieChartLabels, PieChartLegendValues } from './panelcfg.gen';
import { piechartSuggestionsSupplier } from './suggestions';

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
          gradientSupport: true,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
          // Seed fixedColor so switching to Single color, Shades, or Gradient
          // on a fresh panel shows a meaningful color instead of an empty picker.
          fixedColor: '#73BF69',
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
        path: 'sort',
        settings: {
          options: [
            { value: SortOrder.Descending, label: 'Descending' },
            { value: SortOrder.Ascending, label: 'Ascending' },
            { value: SortOrder.None, label: 'None' },
          ],
        },
        defaultValue: SortOrder.Descending,
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
    commonOptionsBuilder.addLegendOptions(builder, false, true);

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
  .setSuggestionsSupplier(piechartSuggestionsSupplier);
