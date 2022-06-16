import { PanelOptionsEditorBuilder, standardEditorsRegistry, StatsPickerConfigSettings } from '@grafana/data';
import { LegendDisplayMode, OptionsWithLegend } from '@grafana/schema';

/**
 * @alpha
 */
export function addLegendOptions<T extends OptionsWithLegend>(
  builder: PanelOptionsEditorBuilder<T>,
  includeLegendCalcs = true
) {
  builder
    .addRadio({
      path: 'legend.displayMode',
      name: 'Legend mode',
      category: ['Legend'],
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
      category: ['Legend'],
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
    .addNumberInput({
      path: 'legend.width',
      name: 'Width',
      category: ['Legend'],
      settings: {
        placeholder: 'Auto',
      },
      showIf: (c) => c.legend.displayMode !== LegendDisplayMode.Hidden && c.legend.placement === 'right',
    });

  if (includeLegendCalcs) {
    builder.addCustomEditor<StatsPickerConfigSettings, string[]>({
      id: 'legend.calcs',
      path: 'legend.calcs',
      name: 'Legend values',
      category: ['Legend'],
      description: 'Select values or calculations to show in legend',
      editor: standardEditorsRegistry.get('stats-picker').editor as any,
      defaultValue: [],
      settings: {
        allowMultiple: true,
      },
      showIf: (currentConfig) => currentConfig.legend.displayMode !== LegendDisplayMode.Hidden,
    });
  }
}
