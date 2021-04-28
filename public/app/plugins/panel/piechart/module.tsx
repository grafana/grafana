import { FieldColorModeId, FieldConfigProperty, PanelPlugin, ReducerID, standardEditorsRegistry } from '@grafana/data';
import { PieChartPanel } from './PieChartPanel';
import { PieChartOptions } from './types';
import { LegendDisplayMode, PieChartType, PieChartLabels, PieChartLegendValues } from '@grafana/ui';
import { PieChartPanelChangedHandler } from './migrations';

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
  })
  .setPanelOptions((builder) => {
    builder
      .addCustomEditor({
        id: 'reduceOptions.calcs',
        path: 'reduceOptions.calcs',
        name: 'Calculation',
        description: 'Choose a reducer function / calculation',
        editor: standardEditorsRegistry.get('stats-picker').editor as any,
        defaultValue: [ReducerID.lastNotNull],
        // Hides it when all values mode is on
        showIf: (currentConfig) => currentConfig.reduceOptions.values === false,
      })
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
      })
      .addRadio({
        name: 'Tooltip mode',
        path: 'tooltip.mode',
        description: '',
        defaultValue: 'single',
        settings: {
          options: [
            { value: 'single', label: 'Single' },
            { value: 'multi', label: 'All' },
            { value: 'none', label: 'Hidden' },
          ],
        },
      })
      .addRadio({
        path: 'legend.displayMode',
        name: 'Legend mode',
        description: '',
        defaultValue: LegendDisplayMode.List,
        settings: {
          options: [
            { value: LegendDisplayMode.List, label: 'List' },
            { value: LegendDisplayMode.Table, label: 'Table' },
            { value: LegendDisplayMode.Hidden, label: 'Hidden' },
          ],
        },
      })
      .addRadio({
        path: 'legend.placement',
        name: 'Legend placement',
        description: '',
        defaultValue: 'right',
        settings: {
          options: [
            { value: 'bottom', label: 'Bottom' },
            { value: 'right', label: 'Right' },
          ],
        },
        showIf: (c) => c.legend.displayMode !== LegendDisplayMode.Hidden,
      })
      .addMultiSelect({
        name: 'Legend values',
        path: 'legend.values',
        settings: {
          options: [
            { value: PieChartLegendValues.Percent, label: 'Percent' },
            { value: PieChartLegendValues.Value, label: 'Value' },
          ],
        },
        showIf: (c) => c.legend.displayMode !== LegendDisplayMode.Hidden,
      });
  });
