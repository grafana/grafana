import { FormEvent } from 'react';

import { t, Trans } from '@grafana/i18n';
import { TableMarkdownCellOptions } from '@grafana/schema';
import { Badge, Field, Label, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const MarkdownCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableMarkdownCellOptions>) => {
  const onDynamicHeightChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.dynamicHeight = e.currentTarget.checked;
    onChange(cellOptions);
  };

  console.log(cellOptions);

  return (
    <Field
      label={
        <Label
          description={t(
            'table.markdown-cell-options-editor.description-dynamic-height',
            'We recommend enabling pagination with this option to avoid performance issues.'
          )}
        >
          <Trans i18nKey="table.markdown-cell-options-editor.label-dynamic-height">Dynamic height</Trans>{' '}
          <Badge
            text={t('table.markdown-cell-options-editor.label.text-alpha', 'Alpha')}
            color="blue"
            style={{ fontSize: '11px', marginLeft: '5px', lineHeight: '1.2' }}
          />
        </Label>
      }
    >
      <Switch onChange={onDynamicHeightChange} value={cellOptions.dynamicHeight} />
    </Field>
  );
};
