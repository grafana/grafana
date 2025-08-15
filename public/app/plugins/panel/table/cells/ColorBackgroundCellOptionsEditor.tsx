import { useId } from 'react';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { TableCellBackgroundDisplayMode, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup, Switch, Label, Badge } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const colorBackgroundOpts: Array<SelectableValue<TableCellBackgroundDisplayMode>> = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];

export const ColorBackgroundCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableColoredBackgroundCellOptions>) => {
  // Set the display mode on change

  const onCellOptionsChange = (v: TableCellBackgroundDisplayMode) => {
    cellOptions.mode = v;
    onChange(cellOptions);
  };

  const onColorRowChange = () => {
    cellOptions.applyToRow = !cellOptions.applyToRow;
    onChange(cellOptions);
  };

  const onWrapTextChange = () => {
    cellOptions.wrapText = !cellOptions.wrapText;
    onChange(cellOptions);
  };

  const applyToRowSwitchId = useId();
  const wrapTextSwitchId = useId();

  const label = (
    <Label
      description={t(
        'table.color-background-cell-options-editor.description-wrap-text',
        'If selected text will be wrapped to the width of text in the configured column'
      )}
      htmlFor={wrapTextSwitchId}
    >
      <Trans i18nKey="table.color-background-cell-options-editor.wrap-text">Wrap text</Trans>{' '}
      <Badge
        text={t('table.color-background-cell-options-editor.label.text-alpha', 'Alpha')}
        color="blue"
        style={{ fontSize: '11px', marginLeft: '5px', lineHeight: '1.2' }}
      />
    </Label>
  );

  return (
    <>
      <Field
        label={t('table.color-background-cell-options-editor.label-background-display-mode', 'Background display mode')}
      >
        <RadioButtonGroup
          value={cellOptions?.mode ?? TableCellBackgroundDisplayMode.Gradient}
          onChange={onCellOptionsChange}
          options={colorBackgroundOpts}
        />
      </Field>
      <Field
        label={t('table.color-background-cell-options-editor.label-apply-to-entire-row', 'Apply to entire row')}
        description={t(
          'table.color-background-cell-options-editor.description-apply-to-entire-row',
          'If selected the entire row will be colored as this cell would be.'
        )}
      >
        <Switch id={applyToRowSwitchId} value={cellOptions.applyToRow} onChange={onColorRowChange} />
      </Field>
      <Field label={label}>
        <Switch id={wrapTextSwitchId} value={cellOptions.wrapText} onChange={onWrapTextChange} />
      </Field>
    </>
  );
};
