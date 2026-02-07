import { PanelOptionsEditorBuilder, standardEditorsRegistry, StatsPickerConfigSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode, OptionsWithLegend, SortOrder } from '@grafana/schema';

/**
 * @alpha
 */
export function addLegendOptions<T extends OptionsWithLegend>(
  builder: PanelOptionsEditorBuilder<T>,
  includeLegendCalcs = true,
  showLegend = true
) {
  const category = [t('grafana-ui.builder.legend.category', 'Legend')];
  builder
    .addBooleanSwitch({
      path: 'legend.showLegend',
      name: t('grafana-ui.builder.legend.name-visibility', 'Visibility'),
      category,
      description: '',
      defaultValue: showLegend,
    })
    .addRadio({
      path: 'legend.displayMode',
      name: t('grafana-ui.builder.legend.name-mode', 'Mode'),
      category,
      description: '',
      defaultValue: LegendDisplayMode.List,
      settings: {
        options: [
          { value: LegendDisplayMode.List, label: t('grafana-ui.builder.legend.mode-options.label-list', 'List') },
          { value: LegendDisplayMode.Table, label: t('grafana-ui.builder.legend.mode-options.label-table', 'Table') },
        ],
      },
      showIf: (c) => c.legend.showLegend,
    })
    .addRadio({
      path: 'legend.placement',
      name: t('grafana-ui.builder.legend.name-placement', 'Placement'),
      category,
      description: '',
      defaultValue: 'bottom',
      settings: {
        options: [
          { value: 'bottom', label: t('grafana-ui.builder.legend.placement-options.label-bottom', 'Bottom') },
          { value: 'right', label: t('grafana-ui.builder.legend.placement-options.label-right', 'Right') },
        ],
      },
      showIf: (c) => c.legend.showLegend,
    })
    .addRadio({
      path: 'legend.sortOrder',
      name: t('grafana-ui.builder.legend.name-sort-order', 'Sort by'),
      category,
      description: '',
      defaultValue: SortOrder.None,
      settings: {
        options: [
          {
            value: SortOrder.None,
            label: t('grafana-ui.builder.legend.sort-order-options.label-none', 'None'),
          },
          {
            value: SortOrder.Ascending,
            label: t('grafana-ui.builder.legend.sort-order-options.label-asc', 'A-Z'),
          },
          {
            value: SortOrder.Descending,
            label: t('grafana-ui.builder.legend.sort-order-options.label-desc', 'Z-A'),
          },
        ],
      },
      showIf: (c) => c.legend.showLegend && c.legend.displayMode === LegendDisplayMode.List,
    })
    .addNumberInput({
      path: 'legend.width',
      name: t('grafana-ui.builder.legend.name-width', 'Width'),
      category,
      settings: {
        placeholder: 'Auto',
      },
      showIf: (c) => c.legend.showLegend && c.legend.placement === 'right',
    });

  if (includeLegendCalcs) {
    builder.addCustomEditor<StatsPickerConfigSettings, string[]>({
      id: 'legend.calcs',
      path: 'legend.calcs',
      name: t('grafana-ui.builder.legend.name-values', 'Values'),
      category,
      description: t('grafana-ui.builder.legend.description-values', 'Select values or calculations to show in legend'),
      editor: standardEditorsRegistry.get('stats-picker').editor,
      defaultValue: [],
      settings: {
        allowMultiple: true,
      },
      showIf: (currentConfig) => currentConfig.legend.showLegend !== false,
    });
  }
}
