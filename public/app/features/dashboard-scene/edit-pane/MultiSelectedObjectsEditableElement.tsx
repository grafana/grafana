import { ReactNode } from 'react';

import { Stack, Text, Button } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { BulkActionElement, MultiSelectedEditableDashboardElement } from '../scene/types';

export class MultiSelectedObjectsEditableElement implements MultiSelectedEditableDashboardElement {
  public isMultiSelectedEditableDashboardElement: true = true;
  private items?: BulkActionElement[];

  constructor(items: BulkActionElement[]) {
    this.items = items;
  }

  public onDelete = () => {
    for (const item of this.items || []) {
      item.onDelete();
    }
  };

  public getTypeName(): string {
    return 'Objects';
  }

  renderActions(): ReactNode {
    return (
      <Stack direction="column">
        <Text>
          <Trans i18nKey="dashboard.edit-pane.objects.multi-select.selection-number">No. of objects selected: </Trans>
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
