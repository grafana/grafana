import { SceneObject } from '@grafana/scenes';

import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

export function addNewTabTo(sceneObject: SceneObject) {
  if (sceneObject instanceof TabsLayoutManager) {
    sceneObject.addNewTab();
    return;
  }

  const layoutParent = sceneObject.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  layoutParent.switchLayout(TabsLayoutManager.createFromLayout(layoutParent.getLayout()));
}

export function addNewRowTo(sceneObject: SceneObject) {
  if (sceneObject instanceof RowsLayoutManager) {
    sceneObject.addNewRow();
    return;
  }

  if (sceneObject instanceof DefaultGridLayoutManager) {
    sceneObject.addNewRow();
    return;
  }

  if (sceneObject instanceof TabsLayoutManager) {
    const currentTab = sceneObject.getCurrentTab();
    addNewRowTo(currentTab.state.layout);
    return;
  }

  const layoutParent = sceneObject.parent!;
  if (!isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  layoutParent.switchLayout(RowsLayoutManager.createFromLayout(layoutParent.getLayout()));
}
