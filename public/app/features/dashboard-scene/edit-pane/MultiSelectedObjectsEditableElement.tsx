import { ReactNode } from 'react';

import { Stack, Text, Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { BulkActionElement } from '../scene/types/BulkActionElement';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';

export class MultiSelectedObjectsEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  constructor(private _elements: BulkActionElement[]) {}

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return [];
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { name: t('dashboard.edit-pane.elements.objects', 'Objects'), typeId: 'objects', icon: 'folder' };
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

  public onDelete = () => {
    this._elements.forEach((item) => item.onDelete());
  };
}
