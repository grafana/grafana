import { type ChangeEvent } from 'react';

import {
  fieldReducers,
  type PanelOptionsEditorBuilder,
  standardEditorsRegistry,
  type StatsPickerConfigSettings,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode, type OptionsWithLegend } from '@grafana/schema';

import { Combobox } from '../../components/Combobox/Combobox';
import { type ComboboxOption } from '../../components/Combobox/types';
import { Input } from '../../components/Input/Input';
import { LEGEND_SORT_BY_NAME } from '../../components/VizLegend/utils';

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
    .addRadio({
      path: 'legend.overflow',
      name: t('grafana-ui.builder.legend.name-overflow', 'Overflow'),
      category,
      description: '',
      settings: {
        options: [
          { value: 'ellipsis', label: t('grafana-ui.builder.legend.overflow-options.label-ellipsis', 'Ellipsis') },
          { value: 'wrap', label: t('grafana-ui.builder.legend.overflow-options.label-wrap', 'Wrap') },
        ],
      },
      showIf: (c) => c.legend.showLegend && c.legend.displayMode === LegendDisplayMode.Table,
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

    // Table mode sorts by clicking column headers; the compact list has no headers, so it needs explicit controls
    builder
      .addCustomEditor<void, string | undefined>({
        id: 'legend.sortBy',
        path: 'legend.sortBy',
        name: t('grafana-ui.builder.legend.name-sort-by', 'Sort by'),
        category,
        description: t(
          'grafana-ui.builder.legend.description-sort-by',
          'Select the value by which legend items are sorted'
        ),
        // Legend sorting matches display value titles, which are reducer names rather than reducer ids
        editor: ({ value, onChange, context }) => {
          const options: Array<ComboboxOption<string>> = [
            { value: LEGEND_SORT_BY_NAME, label: t('grafana-ui.builder.legend.sort-by-options.label-name', 'Name') },
          ];
          const calcs: string[] = context.options?.legend?.calcs ?? [];

          for (const calc of calcs) {
            const reducer = fieldReducers.getIfExists(calc);
            if (reducer) {
              options.push({ value: reducer.name, label: reducer.name, description: reducer.description });
            }
          }

          // Keep a value whose calculation was removed visible, so the user can see why sorting no longer applies
          if (value && !options.some((o) => o.value === value)) {
            options.push({ value, label: value });
          }

          return (
            <Combobox
              options={options}
              value={value ?? null}
              isClearable
              placeholder={t('grafana-ui.builder.legend.placeholder-sort-by', 'None')}
              onChange={(option) => onChange(option?.value)}
            />
          );
        },
        showIf: (c) => c.legend.showLegend && c.legend.displayMode === LegendDisplayMode.List,
      })
      .addRadio({
        path: 'legend.sortDesc',
        name: t('grafana-ui.builder.legend.name-sort-direction', 'Sort direction'),
        category,
        description: '',
        settings: {
          options: [
            {
              value: false,
              label: t('grafana-ui.builder.legend.sort-direction-options.label-ascending', 'Ascending'),
            },
            {
              value: true,
              label: t('grafana-ui.builder.legend.sort-direction-options.label-descending', 'Descending'),
            },
          ],
        },
        showIf: (c) =>
          c.legend.showLegend && c.legend.displayMode === LegendDisplayMode.List && Boolean(c.legend.sortBy),
      });
  }
}
