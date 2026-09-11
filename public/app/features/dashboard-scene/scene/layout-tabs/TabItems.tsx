import { t } from '@grafana/i18n';
import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { getGroupSelectedCategory } from '../layouts-shared/GroupSelectedActions';
import { type EditableDashboardElement, type EditableDashboardElementInfo } from '../types/EditableDashboardElement';

import { type TabItem } from './TabItem';

export class TabItems implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private _tabs: TabItem[]) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeName: t('dashboard.sidebar.elements.tabs', 'Tabs'), icon: 'folder', instanceName: '' };
  }

  public useSidebarOptions(): OptionsPaneCategoryDescriptor[] {
    return [getGroupSelectedCategory(this.getTabs())];
  }

  public getTabs(): TabItem[] {
    return this._tabs;
  }

  public onDelete() {
    this._tabs.forEach((tab) => tab.onDelete());
  }
}
