import { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableAutoCellOptions, TableColoredBackgroundCellOptions, TableColorTextCellOptions } from '@grafana/schema';
import { Field, Input, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const AutoCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableAutoCellOptions | TableColorTextCellOptions | TableColoredBackgroundCellOptions>) => {
  // Handle row coloring changes
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
        <Switch
          label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Wrap text`)}
          value={cellOptions.wrapText}
          onChange={onWrapTextChange}
        />
      </Field>
      {cellOptions.wrapText && (
        <Field label={t('table.auto-cell-options-editor.max-wrapped-lines', 'Wrap text line limit')}>
          <Input
            type="number"
            label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Wrap text line limit`)}
            value={cellOptions.maxWrappedLines}
            onChange={onMaxWrappedLinesChange}
            min={1}
            placeholder={t('table.auto-cell-options-editor.max-wrapped-lines-placeholder', 'none')}
          />
        </Field>
      )}
    </>
  );
};
