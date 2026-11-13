import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type TablePillCellOptions, TablePillColorMode } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { type TableCellEditorProps } from '../TableCellOptionEditor';

export const PillCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TablePillCellOptions>) => {
  const colorModeOptions: Array<SelectableValue<TablePillColorMode>> = [
    { value: TablePillColorMode.Auto, label: t('table.pill-cell-options-editor.color-mode-auto', 'Auto') },
    {
      value: TablePillColorMode.Background,
      label: t('table.pill-cell-options-editor.color-mode-background', 'Background'),
    },
  ];

  return (
    <Field
      noMargin
      label={t('table.pill-cell-options-editor.label-color-mode', 'Pill color mode')}
      description={t(
        'table.pill-cell-options-editor.description-color-mode',
        'Auto adjusts the color for readability in light and dark themes. Background uses the configured color as the pill background as-is, which may have lower contrast.'
      )}
    >
      <RadioButtonGroup<TablePillColorMode>
        value={cellOptions.colorMode ?? TablePillColorMode.Auto}
        onChange={(colorMode) => onChange({ ...cellOptions, colorMode })}
        options={colorModeOptions}
      />
    </Field>
  );
};
