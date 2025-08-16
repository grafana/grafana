import { useId } from 'react';

import { t } from '@grafana/i18n';
import { TableAutoCellOptions, TableColorTextCellOptions } from '@grafana/schema';
import { Field, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const AutoCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableAutoCellOptions | TableColorTextCellOptions>) => {
  const onWrapTextChange = () => {
    /* @ts-ignore this has been migrated out of existence. */
    cellOptions.wrapText = !cellOptions.wrapText;
    onChange(cellOptions);
  };

  const htmlId = useId();

  return (
    <Field
      label={t('table.auto-cell-options-editor.label-wrap-text', 'Wrap text')}
      description={t(
        'table.auto-cell-options-editor.description-wrap-text',
        'If selected text will be wrapped to the width of text in the configured column'
      )}
    >
      {/* @ts-ignore this has been migrated out of existence. */}
      <Switch id={htmlId} value={cellOptions.wrapText} onChange={onWrapTextChange} />
    </Field>
  );
};
