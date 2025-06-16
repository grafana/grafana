import { t } from '@grafana/i18n';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';

import { TabItem } from './TabItem';

export class TabItems implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private _tabs: TabItem[]) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeName: t('dashboard.edit-pane.elements.tabs', 'Tabs'), icon: 'folder', instanceName: '' };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return [];
  }

  public getTabs(): TabItem[] {
    return this._tabs;
  }

  public onDelete() {
    this._tabs.forEach((tab) => tab.onDelete());
  }
}
