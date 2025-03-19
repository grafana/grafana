import { t } from 'app/core/internationalization';
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
    return { typeName: t('dashboard.edit-pane.elements.objects', 'Objects'), icon: 'folder', instanceName: '' };
  }

  public onDelete() {
    this._elements.forEach((item) => item.onDelete());
  }
}
