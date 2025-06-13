import { SelectableValue } from '@grafana/data';
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
  // Set the display mode on change

  const onCellOptionsChange = (v: TableCellBackgroundDisplayMode) => {
    cellOptions.mode = v;
    onChange(cellOptions);
  };
  // Handle row coloring changes
  const onColorRowChange = () => {
    cellOptions.applyToRow = !cellOptions.applyToRow;
    onChange(cellOptions);
  };

  // Handle row coloring changes
  const onWrapTextChange = () => {
    cellOptions.wrapText = !cellOptions.wrapText;
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
      <Field label={t('table.color-background-cell-options-editor.label-wrap-text', 'Wrap text')}>
        <Switch value={cellOptions.wrapText} onChange={onWrapTextChange} />
      </Field>
    </>
  );
};
