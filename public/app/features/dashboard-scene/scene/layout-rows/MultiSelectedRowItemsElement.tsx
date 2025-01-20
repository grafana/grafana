import { useMemo } from 'react';

import { SceneObject, SceneObjectRef } from '@grafana/scenes';
import { Button, Stack, Switch, Text } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { MultiSelectedEditableDashboardElement } from '../types';

import { RowItem } from './RowItem';

export class MultiSelectedRowItemsElement implements MultiSelectedEditableDashboardElement {
  public isMultiSelectedEditableDashboardElement: true = true;

  private items?: Array<SceneObjectRef<RowItem>>;

  constructor(items: Map<string, SceneObjectRef<SceneObject>>) {
    for (const item of items.values()) {
      if (!this.items) {
        this.items = [];
      }

      const row = item.resolve();
      if (row instanceof RowItem) {
        this.items.push(row.getRef());
      }
    }
  }

  useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const rows = this.items;

    const rowOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: 'Multi-selected Row options',
        id: 'ms-row-options',
        isOpenDefault: true,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Hide row header',
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
      item.resolve().onDelete();
    }
  };

  renderActions(): React.ReactNode {
    return (
      <>
        <Stack direction={'column'}>
          <Text>{`No. of panels selected: ${this.items?.length}`}</Text>
          <Stack direction={'row'}>
            <Button size="sm" variant="secondary" icon="copy" />
            <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
          </Stack>
        </Stack>
      </>
    );
  }
}

export function RowHeaderSwitch({ rows }: { rows: Array<SceneObjectRef<RowItem>> | undefined }) {
  if (!rows) {
    return null;
  }

  const { isHeaderHidden = false } = rows[0].resolve().useState();

  return (
    <Switch
      value={isHeaderHidden}
      onChange={() => {
        for (const rowRef of rows) {
          const row = rowRef.resolve();
          row.setState({
            isHeaderHidden: !row.state.isHeaderHidden,
          });
        }
      }}
    />
  );
}
