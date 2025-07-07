import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableCellBackgroundDisplayMode, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

import { AutoCellOptionsEditor } from './AutoCellOptionsEditor';

const colorBackgroundOpts: Array<SelectableValue<TableCellBackgroundDisplayMode>> = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];
export const ColorBackgroundCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableColoredBackgroundCellOptions>) => {
  const onCellOptionsChange = (v: TableCellBackgroundDisplayMode) => {
    cellOptions.mode = v;
    onChange(cellOptions);
  };

  const onColorRowChange = () => {
    cellOptions.applyToRow = !cellOptions.applyToRow;
    onChange(cellOptions);
  };

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
        <Switch value={cellOptions.applyToRow} onChange={onColorRowChange} />
      </Field>
      <AutoCellOptionsEditor cellOptions={cellOptions} onChange={onChange} />
    </>
  );
};
