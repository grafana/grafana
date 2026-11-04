import { type FormEvent } from 'react';

import { t } from '@grafana/i18n';
import { type TableMarkdownCellOptions } from '@grafana/schema';
import { Badge, Field, Label, Switch } from '@grafana/ui';

import { type TableCellEditorProps } from '../TableCellOptionEditor';
import { CellOptionSearchLabel } from './CellOptionSearchLabel';

export const markdownCellOptionLabel = t('table.markdown-cell-options-editor.label-dynamic-height', 'Dynamic height');

export const MarkdownCellOptionsEditor = ({
  cellOptions,
  onChange,
  searchQuery,
}: TableCellEditorProps<TableMarkdownCellOptions>) => {
  const onDynamicHeightChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.dynamicHeight = e.currentTarget.checked;
    onChange(cellOptions);
  };

  return (
    <Field
      noMargin
      label={
        <Label
          description={t(
            'table.markdown-cell-options-editor.description-dynamic-height',
            'We recommend enabling pagination with this option to avoid performance issues.'
          )}
        >
          <CellOptionSearchLabel label={markdownCellOptionLabel} searchQuery={searchQuery} />{' '}
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
