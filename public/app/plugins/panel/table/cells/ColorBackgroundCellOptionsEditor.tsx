import { useId } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableCellBackgroundDisplayMode, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const colorBackgroundOpts: Array<SelectableValue<TableCellBackgroundDisplayMode>> = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];
export const ColorBackgroundCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableColoredBackgroundCellOptions>) => {
  const applyToRowSwitchId = useId();

  return (
    <>
      <Field
        noMargin
        label={t('table.color-background-cell-options-editor.label-background-display-mode', 'Background display mode')}
      >
        <RadioButtonGroup<TableCellBackgroundDisplayMode>
          value={cellOptions?.mode ?? TableCellBackgroundDisplayMode.Gradient}
          onChange={(v) => {
            cellOptions.mode = v;
            onChange(cellOptions);
          }}
          options={colorBackgroundOpts}
        />
      </Field>

      <Field
        noMargin
        label={t('table.color-background-cell-options-editor.label-apply-to-entire-row', 'Apply to entire row')}
        description={t(
          'table.color-background-cell-options-editor.description-apply-to-entire-row',
          'If selected the entire row will be colored as this cell would be.'
        )}
      >
        <Switch
          id={applyToRowSwitchId}
          label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Apply to entire row`)}
          value={cellOptions.applyToRow}
          onChange={() => {
            cellOptions.applyToRow = !cellOptions.applyToRow;
            onChange(cellOptions);
          }}
        />
      </Field>
    </>
  );
};
