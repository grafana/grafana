import { t } from '@grafana/i18n';
import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { endBatch, startBatch } from '../../actions/utils/batch';
import { type DashboardScene } from '../DashboardScene';
import { getGroupSelectedCategory } from '../layouts-shared/GroupSelectedActions';
import { type EditableDashboardElement, type EditableDashboardElementInfo } from '../types/EditableDashboardElement';

import { type TabItem } from './TabItem';

export class TabItems implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(
    private _tabs: TabItem[],
    private _dashboard: DashboardScene
  ) {}

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
    startBatch(
      this._dashboard,
      t('dashboard.edit-actions.remove-multiple', 'Remove {{typeName}} ({{num}})', {
        num: this._tabs.length,
        typeName: this.getEditableElementInfo().typeName.toLowerCase(),
      })
    );

    this._tabs.forEach((tab) => tab.onDelete());

    endBatch(this._dashboard);
  }
}
