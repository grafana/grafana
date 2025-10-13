import memoizeOne from 'memoize-one';

import { NavModel, NavModelItem, NavIndex } from '@grafana/data';
import { FOLDER_ID } from 'app/features/folders/state/navModel';

import { HOME_NAV_ID } from '../reducers/navModel';

const getNotFoundModel = (): NavModel => {
  const node: NavModelItem = {
    id: 'not-found',
    text: 'Page not found',
    icon: 'exclamation-triangle',
    subTitle: '404 Error',
    url: 'not-found',
  };

  return {
    node: node,
    main: node,
  };
};

export const getNavModel = memoizeOne(
  (navIndex: NavIndex, id: string, fallback?: NavModel, onlyChild = false): NavModel => {
    if (navIndex[id]) {
      const node = navIndex[id];
      const main = onlyChild ? node : getRootSectionForNode(node);
      const mainWithActive = enrichNodeWithActiveState(main, id);

      return {
        node: node,
        main: mainWithActive,
      };
    }

    if (fallback) {
      return fallback;
    }

    return getNotFoundModel();
  }
);

export function getRootSectionForNode(node: NavModelItem): NavModelItem {
  // Don't recurse fully up the folder tree when nested folders is enabled
  if (node.id === FOLDER_ID) {
    return node;
  } else {
    return node.parentItem && node.parentItem.id !== HOME_NAV_ID ? getRootSectionForNode(node.parentItem) : node;
  }
}

function enrichNodeWithActiveState(node: NavModelItem, activeId: string): NavModelItem {
  if (node.id === activeId) {
    return { ...node, active: true };
  }

  if (node.children && node.children.length > 0) {
    return {
      ...node,
      children: node.children.map((child) => enrichNodeWithActiveState(child, activeId)),
    };
  }

  return node;
}

export const getTitleFromNavModel = (navModel: NavModel) => {
  return `${navModel.main.text}${navModel.node.text ? ': ' + navModel.node.text : ''}`;
};
