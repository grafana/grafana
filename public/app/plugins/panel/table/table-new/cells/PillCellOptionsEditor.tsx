import { t } from '@grafana/i18n';
import { TablePillCellOptions } from '@grafana/schema';
import { Field, Stack, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const PillCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TablePillCellOptions>) => {
  const wrapText = cellOptions.wrapText ?? false;

  const onWrapTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    const updatedOptions = { ...cellOptions, wrapText: event.currentTarget.checked };
    onChange(updatedOptions);
  };

  return (
    <Stack direction="column" gap={1}>
      <Field
        label={t('table.pill-cell-options-editor.label-wrap-text', 'Wrap text')}
        description={t(
          'table.pill-cell-options-editor.description-wrap-text',
          'Allow pills to wrap to new lines when they exceed the cell width. When disabled, pills will be truncated.'
        )}
      >
        <Switch value={wrapText} onChange={onWrapTextChange} />
      </Field>
    </Stack>
  );
};
