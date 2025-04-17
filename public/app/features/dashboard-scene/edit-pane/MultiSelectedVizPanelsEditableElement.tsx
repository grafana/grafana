import { v4 as uuidv4 } from 'uuid';

import { appEvents } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';

import { VizPanelEditableElement } from './VizPanelEditableElement';

export class MultiSelectedVizPanelsEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly key: string;

  constructor(private _panels: VizPanelEditableElement[]) {
    this.key = uuidv4();
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeName: t('dashboard.edit-pane.elements.panels', 'Panels'), icon: 'folder', instanceName: '' };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const header = new OptionsPaneCategoryDescriptor({
      title: ``,
      id: '',
    });

    return [header];
  }

  public onConfirmDelete() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.edit-pane.elements.multiple-panels', 'Multiple panels'),
        text: t(
          'dashboard.edit-pane.elements.multiple-panels-delete-text',
          'Are you sure you want to delete these panels? All queries will be removed.'
        ),
        onConfirm: () => this.onDelete(),
      })
    );
  }

  public onDelete() {
    this._panels.forEach((panel) => {
      panel.onDelete();
    });
  }
}
