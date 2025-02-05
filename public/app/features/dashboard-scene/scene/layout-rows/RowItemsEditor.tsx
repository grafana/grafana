import { useMemo } from 'react';

import { Button, Stack, Switch, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { RowItem } from './RowItem';
import { RowItems } from './RowItems';

export function getEditOptions(model: RowItems): OptionsPaneCategoryDescriptor[] {
  const rows = model.getRows();

  const rowOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.edit-pane.row.multi-select.options-header', 'Multi-selected Row options'),
      id: 'ms-row-options',
      isOpenDefault: true,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.edit-pane.row.hide', 'Hide row header'),
        render: () => <RowHeaderSwitchMulti rows={rows} />,
      })
    );
  }, [rows]);

  return [rowOptions];
}

export function renderActions(model: RowItems) {
  const rows = model.getRows();

  return (
    <Stack direction="column">
      <Text>
        <Trans i18nKey="dashboard.edit-pane.row.multi-select.selection-number">No. of rows selected: </Trans>
        {rows.length}
      </Text>
      <Stack direction="row">
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={() => model.onDelete()} icon="trash-alt" />
      </Stack>
    </Stack>
  );
}

function RowHeaderSwitchMulti({ rows }: { rows: RowItem[] | undefined }) {
  if (!rows) {
    return null;
  }

  const { isHeaderHidden = false } = rows[0].useState();

  return (
    <Switch
      value={isHeaderHidden}
      onChange={() => {
        for (const row of rows) {
          row.setState({ isHeaderHidden: !isHeaderHidden });
        }
      }}
    />
  );
}
