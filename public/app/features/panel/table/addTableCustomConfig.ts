import { FieldConfigEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableFieldOptions, defaultTableFieldOptions } from '@grafana/schema';

export function addTableCustomConfig<T extends TableFieldOptions>(
  builder: FieldConfigEditorBuilder<T>,
  options?: {
    hideFields?: boolean;
    filters?: boolean;
    wrapHeaderText?: boolean;
  }
) {
  const category = [t('table.category-table', 'Table')];
  builder
    .addNumberInput({
      path: 'minWidth',
      name: t('table.name-min-column-width', 'Minimum column width'),
      category,
      description: t('table.description-min-column-width', 'The minimum width for column auto resizing'),
      settings: {
        placeholder: '150',
        min: 50,
        max: 500,
      },
      shouldApply: () => true,
      defaultValue: defaultTableFieldOptions.minWidth,
    })
    .addNumberInput({
      path: 'width',
      name: t('table.name-column-width', 'Column width'),
      category,
      settings: {
        placeholder: t('table.placeholder-column-width', 'auto'),
        min: 20,
      },
      shouldApply: () => true,
      defaultValue: defaultTableFieldOptions.width,
    })
    .addRadio({
      path: 'align',
      name: t('table.name-column-alignment', 'Column alignment'),
      category,
      settings: {
        options: [
          { label: t('table.column-alignment-options.label-auto', 'Auto'), value: 'auto' },
          { label: t('table.column-alignment-options.label-left', 'Left'), value: 'left' },
          { label: t('table.column-alignment-options.label-center', 'Center'), value: 'center' },
          { label: t('table.column-alignment-options.label-right', 'Right'), value: 'right' },
        ],
      },
      defaultValue: defaultTableFieldOptions.align,
    })
    .addBooleanSwitch({
      path: 'wrapText',
      name: t('table.name-wrap-text', 'Wrap text'),
      category,
    });

  if (options?.wrapHeaderText) {
    builder.addBooleanSwitch({
      path: 'wrapHeaderText',
      name: t('table.name-wrap-header-text', 'Wrap header text'),
      category,
    });
  }

  if (options?.filters) {
    builder.addBooleanSwitch({
      path: 'filterable',
      name: t('table.name-column-filter', 'Column filter'),
      category,
      description: t('table.description-column-filter', 'Enables/disables field filters in table'),
      defaultValue: defaultTableFieldOptions.filterable,
    });
  }

  if (options?.hideFields) {
    builder.addBooleanSwitch({
      path: 'hideFrom.viz',
      name: t('table.name-hide-in-table', 'Hide in table'),
      category,
      defaultValue: undefined,
      hideFromDefaults: true,
    });
  }
}
