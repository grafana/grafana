import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';
import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type BulkActionElement } from '../scene/types/BulkActionElement';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../scene/types/EditableDashboardElement';

export class MultiSelectedObjectsEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  constructor(private _elements: BulkActionElement[]) {}

  public useSidebarOptions(): OptionsPaneCategoryDescriptor[] {
    return [];
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeName: t('dashboard.sidebar.elements.objects', 'Objects'), icon: 'folder', instanceName: '' };
  }

  public onConfirmDelete() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.sidebar.elements.multiple-elements', 'Multiple elements'),
        text: t(
          'dashboard.sidebar.elements.multiple-elements-delete-text',
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
