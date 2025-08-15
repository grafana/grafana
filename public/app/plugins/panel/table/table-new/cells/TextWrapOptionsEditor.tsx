import { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableCellOptions, TableWrapTextOptions } from '@grafana/schema';
import { Field, Input, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const TextWrapOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableCellOptions & TableWrapTextOptions>) => {
  const onWrapTextChange = () => {
    cellOptions.wrapText = !cellOptions.wrapText;
    onChange(cellOptions);
  };

  const onMaxWrappedHeightChange = (ev: FormEvent<HTMLInputElement>) => {
    cellOptions.maxHeight = ev.currentTarget.value === '' ? undefined : parseInt(ev.currentTarget.value, 10);
    onChange(cellOptions);
  };

  return (
    <>
      <Field label={t('table.text-wrap-options.label-wrap-text', 'Wrap text')}>
        <Switch
          // needs to be label and not data-testid because of how Switch is implemented
          label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Wrap text`)}
          value={cellOptions.wrapText}
          onChange={onWrapTextChange}
        />
      </Field>

      {cellOptions.wrapText && (
        <Field label={t('table.text-wrap-options.label-max-height', 'Max cell height')}>
          <Input
            type="number"
            min="0"
            data-testid={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Max cell height`)}
            value={cellOptions.maxHeight}
            onChange={onMaxWrappedHeightChange}
            placeholder={t('table.text-wrap-options.placeholder-max-height', 'none')}
          />
        </Field>
      )}
    </>
  );
};
