import { SceneGridRow, SceneObject } from '@grafana/scenes';

import { RowItem } from '../layout-rows/RowItem';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

/**
 * Will scroll element into view. If element is not connected yet, it will try to expand rows
 * and switch tabs to make it visible.
 */
export function scrollCanvasElementIntoView(
  sceneObject: SceneObject,
  refOrSelector: React.RefObject<HTMLElement> | string
) {
  if (tryScroll(refOrSelector)) {
    return;
  }

  openParentLayouts(sceneObject);

  // now try to scroll into view
  setTimeout(() => {
    tryScroll(refOrSelector);
  }, 10);
}

function tryScroll(refOrSelector: React.RefObject<HTMLElement> | string): boolean {
  if (typeof refOrSelector === 'string') {
    const element = document.querySelector(refOrSelector);
    if (element instanceof HTMLElement) {
      scrollIntoView(element);
      return true;
    }
    return false;
  }

  if (refOrSelector.current?.isConnected) {
    scrollIntoView(refOrSelector.current);
    return true;
  }
  return false;
}

function openParentLayouts(sceneObject: SceneObject) {
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
}

export function scrollIntoView(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}
