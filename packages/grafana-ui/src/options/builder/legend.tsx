import { t } from 'i18next';

import { PanelOptionsEditorBuilder, standardEditorsRegistry, StatsPickerConfigSettings } from '@grafana/data';
import { LegendDisplayMode, OptionsWithLegend } from '@grafana/schema';

/**
 * @alpha
 */
export function addLegendOptions<T extends OptionsWithLegend>(
  builder: PanelOptionsEditorBuilder<T>,
  includeLegendCalcs = true,
  showLegend = true
) {
  builder
    .addBooleanSwitch({
      path: 'legend.showLegend',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.legend.visibility', 'Visibility'),
      category: [t('bmcgrafana.dashboards.edit-panel.legend.text', 'Legend')],
      // BMC Change ends
      description: '',
      defaultValue: showLegend,
    })
    .addRadio({
      path: 'legend.displayMode',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.legend.mode', 'Mode'),
      category: [t('bmcgrafana.dashboards.edit-panel.legend.text', 'Legend')],
      // BMC Change ends
      description: '',
      defaultValue: LegendDisplayMode.List,
      settings: {
        options: [
          // BMC Change: To enable localization for below text
          { value: LegendDisplayMode.List, label: t('bmcgrafana.dashboards.edit-panel.legend.mode-list', 'List') },
          { value: LegendDisplayMode.Table, label: t('bmcgrafana.dashboards.edit-panel.legend.mode-table', 'Table') },
          // BMC Change ends
        ],
      },
      showIf: (c) => c.legend.showLegend,
    })
    .addRadio({
      path: 'legend.placement',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.legend.placement', 'Placement'),
      category: [t('bmcgrafana.dashboards.edit-panel.legend.text', 'Legend')],
      // BMC change ends
      description: '',
      defaultValue: 'bottom',
      settings: {
        options: [
          // BMC Change: To enable localization for below text
          { value: 'bottom', label: t('bmcgrafana.dashboards.edit-panel.legend.placement-bottom-text', 'Bottom') },
          { value: 'right', label: t('bmcgrafana.dashboards.edit-panel.overrides.button.right', 'Right') },
          // BMC Change ends
        ],
      },
      showIf: (c) => c.legend.showLegend,
    })
    .addNumberInput({
      path: 'legend.width',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.legend.width', 'Width'),
      category: [t('bmcgrafana.dashboards.edit-panel.legend.text', 'Legend')],
      // BMC Change ends
      settings: {
        // BMC Change: To enable localization for below text
        placeholder: t('bmcgrafana.dashboards.edit-panel.axis.grid-lines.auto-text', 'Auto'),
        // BMC change ends
      },
      showIf: (c) => c.legend.showLegend && c.legend.placement === 'right',
    });

  if (includeLegendCalcs) {
    builder.addCustomEditor<StatsPickerConfigSettings, string[]>({
      id: 'legend.calcs',
      path: 'legend.calcs',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.legend.values-text', 'Values'),
      category: [t('bmcgrafana.dashboards.edit-panel.legend.text', 'Legend')],
      description: t(
        'bmcgrafana.dashboards.edit-panel.legend.values-description',
        'Select values or calculations to show in legend'
      ),
      // BMC change ends
      editor: standardEditorsRegistry.get('stats-picker').editor,
      defaultValue: [],
      settings: {
        allowMultiple: true,
      },
      showIf: (currentConfig) => currentConfig.legend.showLegend !== false,
    });
  }
}
