import { type ChangeEvent } from 'react';

import { type PanelOptionsEditorBuilder, standardEditorsRegistry, type StatsPickerConfigSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode, type OptionsWithLegend } from '@grafana/schema';

import { Input } from '../../components/Input/Input';

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
    .addCustomEditor({
      id: 'legend.width',
      path: 'legend.width',
      name: t('grafana-ui.builder.legend.name-width', 'Width'),
      category,
      showIf: (c) => c.legend.showLegend && c.legend.placement === 'right',
      editor: ({ onChange, ...props }) => {
        return (
          <Input
            {...props}
            placeholder={t('grafana-ui.builder.legend.placeholder-width', 'Auto, px, or % (e.g. 220 or 35%)')}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              let value: string | undefined = e.currentTarget.value.trim();

              if (value === '') {
                value = undefined;
              }

              let numeric = Number(value);
              onChange(Number.isNaN(numeric) ? value : numeric);
            }}
            // this is needed as a work-around for _something_ in an ancestor causing a blur/onChange/remount happen on every keypress
            onInputCapture={(e) => {
              e.stopPropagation();
            }}
          />
        );
      },
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
