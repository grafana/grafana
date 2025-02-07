import { Button, Checkbox, Stack, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { RowItems } from './RowItems';

export function getEditOptions(model: RowItems): OptionsPaneCategoryDescriptor[] {
  const options = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.edit-pane.row.multi-select.options-header', 'Multi-selected Row options'),
    id: `ms-row-options-${model.key}`,
    isOpenDefault: true,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.edit-pane.row.header.title', 'Row header'),
      render: () => <RowHeaderCheckboxMulti model={model} />,
    })
  );

  return [options];
}

export function renderActions(model: RowItems) {
  const rows = model.getRows();

  return (
    <Stack direction="column">
      <Text>
        <Trans i18nKey="dashboard.edit-pane.row.multi-select.selection-number" values={{ length: rows.length }}>
          No. of rows selected: {{ length }}
        </Trans>
      </Text>
      <Stack direction="row">
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={() => model.onDelete()} icon="trash-alt" />
      </Stack>
    </Stack>
  );
}

function RowHeaderCheckboxMulti({ model }: { model: RowItems }) {
  const rows = model.getRows();

  let value = false;
  let indeterminate = false;

  for (let i = 0; i < rows.length; i++) {
    const { isHeaderHidden } = rows[i].useState();

    const prevElement = rows[i - 1];
    indeterminate = indeterminate || (prevElement && !!prevElement.state.isHeaderHidden !== !!isHeaderHidden);

    value = value || !!isHeaderHidden;
  }

  return (
    <Checkbox
      label={t('dashboard.edit-pane.row.header.hide', 'Hide')}
      value={value}
      indeterminate={indeterminate}
      onChange={() => model.onHeaderHiddenToggle(value, indeterminate)}
    />
  );
}
