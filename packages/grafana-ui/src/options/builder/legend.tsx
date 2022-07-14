import { PanelOptionsEditorBuilder, standardEditorsRegistry, StatsPickerConfigSettings } from '@grafana/data';
import { LegendDisplayMode, LegendVisibility, OptionsWithLegend } from '@grafana/schema';

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
      name: 'Mode',
      category: ['Legend'],
      description: '',
      defaultValue: LegendDisplayMode.List,
      settings: {
        options: [
          { value: LegendDisplayMode.List, label: 'List' },
          { value: LegendDisplayMode.Table, label: 'Table' },
        ],
      },
    })
    .addRadio({
      path: 'legend.showLegend',
      name: 'Visibility',
      category: ['Legend'],
      description: '',
      defaultValue: LegendVisibility.Visible,
      settings: {
        options: [
          { value: LegendVisibility.Visible, label: 'Visible' },
          { value: LegendVisibility.Hidden, label: 'Hidden' },
        ],
      },
    })
    .addRadio({
      path: 'legend.placement',
      name: 'Placement',
      category: ['Legend'],
      description: '',
      defaultValue: 'bottom',
      settings: {
        options: [
          { value: 'bottom', label: 'Bottom' },
          { value: 'right', label: 'Right' },
        ],
      },
      showIf: (c) => c.legend.showLegend !== LegendVisibility.Hidden,
    })
    .addNumberInput({
      path: 'legend.width',
      name: 'Width',
      category: ['Legend'],
      settings: {
        placeholder: 'Auto',
      },
      showIf: (c) => c.legend.showLegend !== LegendVisibility.Hidden && c.legend.placement === 'right',
    });

  if (includeLegendCalcs) {
    builder.addCustomEditor<StatsPickerConfigSettings, string[]>({
      id: 'legend.calcs',
      path: 'legend.calcs',
      name: 'Values',
      category: ['Legend'],
      description: 'Select values or calculations to show in legend',
      editor: standardEditorsRegistry.get('stats-picker').editor as any,
      defaultValue: [],
      settings: {
        allowMultiple: true,
      },
      showIf: (currentConfig) => currentConfig.legend.showLegend !== LegendVisibility.Hidden,
    });
  }
}
