import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableAutoCellOptions, TableColoredBackgroundCellOptions, TableColorTextCellOptions } from '@grafana/schema';
import { Field, Switch } from '@grafana/ui';

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

  return (
    <Field label={t('table.auto-cell-options-editor.label-wrap-text', 'Wrap text')}>
      <Switch
        label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Wrap text`)}
        value={cellOptions.wrapText}
        onChange={onWrapTextChange}
      />
    </Field>
  );
};
