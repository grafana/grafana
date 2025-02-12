import { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { MultiSelectedEditableDashboardElement } from '../types/MultiSelectedEditableDashboardElement';

import { TabItem } from './TabItem';
import { getEditOptions, renderActions } from './TabItemsEditor';

export class TabItems implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly typeName = 'Tabs';
  public readonly key: string;

  public constructor(private _tabs: TabItem[]) {
    this.key = uuidv4();
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return getEditOptions(this);
  }

  public renderActions(): ReactNode {
    return renderActions(this);
  }

  public getTabs(): TabItem[] {
    return this._tabs;
  }

  public onDelete() {
    this._tabs.forEach((tab) => tab.onDelete());
  }
}
