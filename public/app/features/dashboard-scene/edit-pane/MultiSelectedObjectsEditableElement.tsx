import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/core';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { BulkActionElement } from '../scene/types/BulkActionElement';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';

export class MultiSelectedObjectsEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  constructor(private _elements: BulkActionElement[]) {}

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return [];
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeName: t('dashboard.edit-pane.elements.objects', 'Objects'), icon: 'folder', instanceName: '' };
  }

  public onConfirmDelete() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.edit-pane.elements.multiple-elements', 'Multiple elements'),
        text: t(
          'dashboard.edit-pane.elements.multiple-elements-delete-text',
          'Are you sure you want to delete these elements?'
        ),
        onConfirm: () => this.onDelete(),
      })
    );
  }

  public onDelete() {
    this._elements.forEach((item) => item.onDelete());
  }
}
