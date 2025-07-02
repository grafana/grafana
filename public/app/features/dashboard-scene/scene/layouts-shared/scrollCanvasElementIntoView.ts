import { SceneGridRow, SceneObject } from '@grafana/scenes';

import { RowItem } from '../layout-rows/RowItem';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

/**
 * Will scroll element into view. If element is not connected yet, it will try to expand rows
 * and switch tabs to make it visible.
 */
export function scrollCanvasElementIntoView(sceneObject: SceneObject, ref: React.RefObject<HTMLElement>) {
  if (ref.current?.isConnected) {
    scrollIntoView(ref.current);
    return;
  }

  // try expanding rows and switching tabs
  let parent = sceneObject.parent;
  while (parent) {
    if (parent instanceof RowItem && parent.state.collapse) {
      parent.onCollapseToggle();
    }

    if (parent instanceof SceneGridRow && parent.state.isCollapsed) {
      parent.onCollapseToggle();
    }

    if (parent instanceof TabItem) {
      const tabsManager = parent.parent;
      if (tabsManager instanceof TabsLayoutManager && tabsManager.getCurrentTab() !== parent) {
        tabsManager.switchToTab(parent);
      }
    }
    parent = parent.parent;
  }

  // now try to scroll into view
  setTimeout(() => {
    if (ref.current?.isConnected) {
      scrollIntoView(ref.current);
    }
  }, 10);
}

export function scrollIntoView(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}
