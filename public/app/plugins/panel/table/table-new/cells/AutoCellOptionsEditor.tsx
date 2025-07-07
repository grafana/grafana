import { FormEvent } from 'react';

import { t } from '@grafana/i18n';
import { TableAutoCellOptions, TableColorTextCellOptions, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Field, Input, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export function AutoCellOptionsEditor<
  P extends TableAutoCellOptions | TableColorTextCellOptions | TableColoredBackgroundCellOptions,
>({ cellOptions, onChange }: TableCellEditorProps<P>) {
  const onWrapTextChange = () => {
    cellOptions.wrapText = !cellOptions.wrapText;
    onChange(cellOptions);
  };

  const onMaxWrappedLinesChange = (ev: FormEvent<HTMLInputElement>) => {
    cellOptions.maxWrappedLines = ev.currentTarget.value ? Number(ev.currentTarget.value) : undefined;
    onChange(cellOptions);
  };

  return (
    <>
      <Field label={t('table.auto-cell-options-editor.label-wrap-text', 'Wrap text')}>
        <Switch value={cellOptions.wrapText} onChange={onWrapTextChange} />
      </Field>
      {cellOptions.wrapText && (
        <Field label={t('table.auto-cell-options-editor.max-wrapped-lines', 'Wrap text line limit')}>
          <Input
            type="number"
            value={cellOptions.maxWrappedLines}
            onChange={onMaxWrappedLinesChange}
            min={1}
            placeholder={t('table.auto-cell-options-editor.max-wrapped-lines-placeholder', 'none')}
          />
        </Field>
      )}
    </>
  );
}
