import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TablePillColorMode, type TablePillCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { type TableCellEditorProps } from '../TableCellOptionEditor';

const pillColorModeOpts: Array<SelectableValue<TablePillColorMode>> = [
  { value: TablePillColorMode.Accessible, label: 'Accessible' },
  { value: TablePillColorMode.Exact, label: 'Exact' },
];

export const PillCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TablePillCellOptions>) => {
  return (
    <Field
      noMargin
      label={t('table.pill-cell-options-editor.label-color-mode', 'Pill color mode')}
      description={t(
        'table.pill-cell-options-editor.description-color-mode',
        'Accessible adjusts the color for readability in light and dark themes. Exact uses the configured color directly as the pill background, which may be hard to read in some themes.'
      )}
    >
      <RadioButtonGroup<TablePillColorMode>
        value={cellOptions?.colorMode ?? TablePillColorMode.Accessible}
        onChange={(v) => {
          onChange({ ...cellOptions, colorMode: v });
        }}
        options={pillColorModeOpts}
      />
    </Field>
  );
};
