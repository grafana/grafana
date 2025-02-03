import { ReactNode, useMemo } from 'react';

import { SceneObject } from '@grafana/scenes';
import { Button, Stack, Switch, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { MultiSelectedEditableDashboardElement } from '../types';

import { RowItem } from './RowItem';

export class MultiSelectedRowItemsElement implements MultiSelectedEditableDashboardElement {
  public isMultiSelectedEditableDashboardElement: true = true;

  private items?: RowItem[];

  constructor(items: SceneObject[]) {
    this.items = [];

    for (const item of items) {
      if (item instanceof RowItem) {
        this.items.push(item);
      }
    }
  }

  useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const rows = this.items;

    const rowOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: t('dashboard.edit-pane.row.multi-select.options-header', 'Multi-selected Row options'),
        id: 'ms-row-options',
        isOpenDefault: true,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.row.hide', 'Hide row header'),
          render: () => <RowHeaderSwitch rows={rows} />,
        })
      );
    }, [rows]);

    return [rowOptions];
  }

  public getTypeName(): string {
    return 'Rows';
  }

  public onDelete = () => {
    for (const item of this.items || []) {
      item.onDelete();
    }
  };

  renderActions(): ReactNode {
    return (
      <Stack direction="column">
        <Text>
          <Trans i18nKey="dashboard.edit-pane.row.multi-select.selection-number">No. of rows selected: </Trans>
          {this.items?.length}
        </Text>
        <Stack direction="row">
          <Button size="sm" variant="secondary" icon="copy" />
          <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
        </Stack>
      </Stack>
    );
  }
}

export function RowHeaderSwitch({ rows }: { rows: RowItem[] | undefined }) {
  if (!rows) {
    return null;
  }

  const { isHeaderHidden = false } = rows[0].useState();

  return (
    <Switch
      value={isHeaderHidden}
      onChange={() => {
        for (const row of rows) {
          row.setState({
            isHeaderHidden: !isHeaderHidden,
          });
        }
      }}
    />
  );
}
