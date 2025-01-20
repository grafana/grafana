import { SceneObject, SceneObjectRef } from '@grafana/scenes';
import { Button } from '@grafana/ui';

import { BulkEditableDashboardElements } from '../types';

import { RowItem } from './RowItem';

export class BulkRowItemsElement implements BulkEditableDashboardElements {
  public isBulkEditableDashboardElements: true = true;

  private items?: Array<SceneObjectRef<RowItem>>;

  constructor(items: Array<SceneObjectRef<SceneObject>>) {
    for (const item of items) {
      if (!this.items) {
        this.items = [];
      }

      const row = item.resolve();
      if (row instanceof RowItem) {
        this.items.push(row.getRef());
      }
    }
  }

  public getTypeName(): string {
    return 'Bulk Rows';
  }

  public onDelete = () => {
    for (const item of this.items || []) {
      item.resolve().onDelete();
    }
  };

  renderBulkActions(): React.ReactNode {
    return (
      <>
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
      </>
    );
  }
}
