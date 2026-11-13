import { type FormEvent } from 'react';

import { t } from '@grafana/i18n';
import { type TableMarkdownCellOptions } from '@grafana/schema';
import { Badge, Field, Label, Switch } from '@grafana/ui';

import { type TableCellEditorProps } from '../TableCellOptionEditor';

// A function (not a constant) so the label stays single-sourced between rendering and the
// options-pane search keywords (see #136909) without a top-level translation
export function getMarkdownCellOptionLabels() {
  return {
    dynamicHeight: t('table.markdown-cell-options-editor.label-dynamic-height', 'Dynamic height'),
  };
}

export const MarkdownCellOptionsEditor = ({
  cellOptions,
  onChange,
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
          {getMarkdownCellOptionLabels().dynamicHeight}{' '}
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
