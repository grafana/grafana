import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableCellOptions, TableWrapTextOptions } from '@grafana/schema';
import { Field, Switch } from '@grafana/ui';

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

  return (
    <>
      <Field label={t('table.text-wrap-options.label-wrap-text', 'Wrap text')}>
        <Switch
          label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Wrap text`)}
          value={cellOptions.wrapText}
          onChange={onWrapTextChange}
        />
      </Field>
    </>
  );
};
