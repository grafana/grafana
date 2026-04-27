import { standardEditorsRegistry, type StatsPickerConfigSettings } from '@grafana/data/field';
import type { PanelOptionsEditorBuilder } from '@grafana/data/utils';
import { t } from '@grafana/i18n';
import { LegendDisplayMode, type OptionsWithLegend } from '@grafana/schema';

/** @public */
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
    .addNumberInput({
      path: 'legend.width',
      name: t('grafana-ui.builder.legend.name-width', 'Width'),
      category,
      settings: {
        placeholder: 'Auto',
      },
      showIf: (c) => c.legend.showLegend && c.legend.placement === 'right',
    })
    .addNumberInput({
      path: 'legend.limit',
      name: t('grafana-ui.builder.legend.name-limit', 'Limit'),
      category,
      description: t('grafana-ui.builder.legend.description-limit', 'Limits how many items are shown by default'),
      showIf: (c) => c.legend.showLegend,
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
