import { t } from '@grafana/i18n';
import { TableAutoCellOptions, TableColorTextCellOptions } from '@grafana/schema';
import { Field, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const AutoCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableAutoCellOptions | TableColorTextCellOptions>) => {
  // Handle row coloring changes

  const onWrapTextChange = () => {
    cellOptions.wrapText = !cellOptions.wrapText;
    onChange(cellOptions);
  };

  return (
    <Field
      label={t('table.auto-cell-options-editor.label-wrap-text', 'Wrap text')}
      description={t(
        'table.auto-cell-options-editor.description-wrap-text',
        'If selected text will be wrapped to the width of text in the configured column'
      )}
    >
      <Switch value={cellOptions.wrapText} onChange={onWrapTextChange} />
    </Field>
  );
};
