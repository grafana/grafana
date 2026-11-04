import { useId } from 'react';

import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableCellBackgroundDisplayMode, type TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup, Switch } from '@grafana/ui';

import { type TableCellEditorProps } from '../TableCellOptionEditor';
import { CellOptionSearchLabel } from './CellOptionSearchLabel';

export const colorBackgroundCellOptionLabels = {
  displayMode: t('table.color-background-cell-options-editor.label-background-display-mode', 'Background display mode'),
  applyToRow: t('table.color-background-cell-options-editor.label-apply-to-entire-row', 'Apply to entire row'),
};

const colorBackgroundOpts: Array<SelectableValue<TableCellBackgroundDisplayMode>> = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];
export const ColorBackgroundCellOptionsEditor = ({
  cellOptions,
  onChange,
  searchQuery,
}: TableCellEditorProps<TableColoredBackgroundCellOptions>) => {
  const applyToRowSwitchId = useId();

  return (
    <>
      <Field
        noMargin
        label={<CellOptionSearchLabel label={colorBackgroundCellOptionLabels.displayMode} searchQuery={searchQuery} />}
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
        label={<CellOptionSearchLabel label={colorBackgroundCellOptionLabels.applyToRow} searchQuery={searchQuery} />}
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
