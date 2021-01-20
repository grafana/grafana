import { PanelPlugin, standardEditorsRegistry, StatsPickerConfigSettings } from '@grafana/data';
import { GraphFieldConfig, LegendDisplayMode } from '@grafana/ui';
import { TimeSeriesPanel } from './TimeSeriesPanel';
import { graphPanelChangedHandler } from './migrations';
import { Options } from './types';
import { defaultGraphConfig, getGraphFieldConfig } from './config';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(TimeSeriesPanel)
  .setPanelChangeHandler(graphPanelChangedHandler)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'tooltipOptions.mode',
        name: 'Tooltip mode',
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
        defaultValue: 'bottom',
        settings: {
          options: [
            { value: 'bottom', label: 'Bottom' },
            { value: 'right', label: 'Right' },
          ],
        },
        showIf: (c) => c.legend.displayMode !== LegendDisplayMode.Hidden,
      })
      .addCustomEditor<StatsPickerConfigSettings, string[]>({
        id: 'legend.calcs',
        path: 'legend.calcs',
        name: 'Legend calculations',
        description: 'Choose a reducer functions / calculations to include in legend',
        editor: standardEditorsRegistry.get('stats-picker').editor as any,
        defaultValue: [],
        settings: {
          allowMultiple: true,
        },
        showIf: (currentConfig) => currentConfig.legend.displayMode !== LegendDisplayMode.Hidden,
      });
  });
