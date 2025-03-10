import { SceneGridRow, SceneObject } from '@grafana/scenes';

import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

export function addNewTabTo(sceneObject: SceneObject): TabItem {
  if (sceneObject instanceof TabsLayoutManager) {
    return sceneObject.addNewTab();
  }

  const layoutParent = sceneObject.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  const tabsLayout = TabsLayoutManager.createFromLayout(layoutParent.getLayout());
  layoutParent.switchLayout(tabsLayout);

  return tabsLayout.state.tabs[0];
}

export function addNewRowTo(sceneObject: SceneObject): RowItem | SceneGridRow {
  if (sceneObject instanceof RowsLayoutManager) {
    return sceneObject.addNewRow();
  }

  if (sceneObject instanceof DefaultGridLayoutManager) {
    return sceneObject.addNewRow();
  }

  if (sceneObject instanceof TabsLayoutManager) {
    const currentTab = sceneObject.getCurrentTab();
    return addNewRowTo(currentTab.state.layout);
  }

  const layoutParent = sceneObject.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  const rowsLayout = RowsLayoutManager.createFromLayout(layoutParent.getLayout());
  layoutParent.switchLayout(rowsLayout);

  return rowsLayout.state.rows[0];
}
