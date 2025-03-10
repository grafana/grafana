import { v4 as uuidv4 } from 'uuid';

import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

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

  public onDelete() {
    this._panels.forEach((panel) => {
      panel.onDelete();
    });
  }
}
