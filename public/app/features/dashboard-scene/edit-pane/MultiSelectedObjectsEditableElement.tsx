import { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Stack, Text, Button } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { BulkActionElement } from '../scene/types/BulkActionElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';

export class MultiSelectedObjectsEditableElement implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly typeName = 'Objects';
  public readonly key: string;

  constructor(private _elements: BulkActionElement[]) {
    this.key = uuidv4();
  }

  public renderActions(): ReactNode {
    return (
      <Stack direction="column">
        <Text>
          <Trans
            i18nKey="dashboard.edit-pane.objects.multi-select.selection-number"
            values={{ length: this._elements.length }}
          >
            No. of objects selected: {{ length }}
          </Trans>
        </Text>
        <Stack direction="row">
          <Button size="sm" variant="secondary" icon="copy" />
          <Button size="sm" variant="destructive" fill="outline" onClick={() => this.onDelete()} icon="trash-alt" />
        </Stack>
      </Stack>
    );
  }

  public onDelete() {
    this._elements.forEach((item) => item.onDelete());
  }
}
