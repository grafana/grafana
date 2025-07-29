import { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { TableCellOptions, TableWrapTextOptions } from '@grafana/schema';
import { Badge, Field, Input, Label, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const TextWrapOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableCellOptions & TableWrapTextOptions>) => {
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
      <Field label={t('table.text-wrap-options.label-wrap-text', 'Wrap text')}>
        <Switch
          label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Wrap text`)}
          value={cellOptions.wrapText}
          onChange={onWrapTextChange}
        />
      </Field>
      {cellOptions.wrapText && (
        <Field
          label={
            <Label
              description={t(
                'table.text-wrap-options.max-wrapped-lines.description',
                'Limits the number of lines displayed when wrapping text in a cell.'
              )}
            >
              <Trans i18nKey="table.text-wrap-options.max-wrapped-lines.label">Wrapped line limit</Trans>&nbsp;
              <Badge
                text={t('table.text-wrap-options.max-wrapped-lines.text-alpha', 'Alpha')}
                color="blue"
                style={{ display: 'inline-block', fontSize: '11px', marginLeft: '5px', lineHeight: '1.2' }}
              />
            </Label>
          }
        >
          <Input
            type="number"
            aria-label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Wrap text line limit`)}
            value={cellOptions.maxWrappedLines}
            onChange={onMaxWrappedLinesChange}
            min={1}
            placeholder={t('table.text-wrap-options.max-wrapped-lines-placeholder', 'none')}
          />
        </Field>
      )}
    </>
  );
};
