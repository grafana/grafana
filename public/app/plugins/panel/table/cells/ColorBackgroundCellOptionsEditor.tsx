import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableCellBackgroundDisplayMode, type TableColoredBackgroundCellOptions } from '@grafana/schema';
import { RadioButtonGroup, Switch } from '@grafana/ui';

import {
  type TableCellOptionEditorDefinition,
  type TableCellOptionEditorProps,
  renderCellOptionEditors,
} from './TableCellOptionEditorRegistry';

type Props = TableCellOptionEditorProps<TableColoredBackgroundCellOptions>;

const colorBackgroundOpts: Array<SelectableValue<TableCellBackgroundDisplayMode>> = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];
const ColorBackgroundDisplayModeEditor = ({ cellOptions, onChange, id, labelId }: Props) => (
  <RadioButtonGroup<TableCellBackgroundDisplayMode>
    id={id}
    aria-labelledby={labelId}
    value={cellOptions?.mode ?? TableCellBackgroundDisplayMode.Gradient}
    onChange={(v) => {
      cellOptions.mode = v;
      onChange(cellOptions);
    }}
    options={colorBackgroundOpts}
  />
);

const ApplyToRowEditor = ({ cellOptions, onChange, id }: Props) => {
  return (
    <Switch
      id={id}
      label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Apply to entire row`)}
      value={cellOptions.applyToRow}
      onChange={() => {
        cellOptions.applyToRow = !cellOptions.applyToRow;
        onChange(cellOptions);
      }}
    />
  );
};

export const colorBackgroundCellOptionEditors: Array<
  TableCellOptionEditorDefinition<TableColoredBackgroundCellOptions>
> = [
  {
    id: 'mode',
    name: () =>
      t('table.color-background-cell-options-editor.label-background-display-mode', 'Background display mode'),
    Editor: ColorBackgroundDisplayModeEditor,
  },
  {
    id: 'applyToRow',
    name: () => t('table.color-background-cell-options-editor.label-apply-to-entire-row', 'Apply to entire row'),
    description: () =>
      t(
        'table.color-background-cell-options-editor.description-apply-to-entire-row',
        'If selected the entire row will be colored as this cell would be.'
      ),
    Editor: ApplyToRowEditor,
  },
];

export const ColorBackgroundCellOptionsEditor = (props: Props) =>
  renderCellOptionEditors(colorBackgroundCellOptionEditors, props);
