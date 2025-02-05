import { ReactNode } from 'react';

import { Stack, Text, Button } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { BulkActionElement } from '../scene/types/BulkActionElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';

export class MultiSelectedObjectsEditableElement implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly typeName = 'Objects';

  private items?: BulkActionElement[];

  constructor(items: BulkActionElement[]) {
    this.items = items;
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
