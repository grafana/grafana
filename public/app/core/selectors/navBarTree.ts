import { NavModelItem, NavModel } from '@grafana/data';

import { HOME_NAV_ID } from '../reducers/_navModel';

export function findNavModelItem(navTree: NavModelItem[], navId: string): NavModelItem | undefined {
  for (const navItem of navTree) {
    if (navItem.id === navId) {
      return navItem;
    }

    const foundChild = findNavModelItem(navItem.children ?? [], navId);
    if (foundChild) {
      return foundChild;
    }
  }

  return undefined;
}

export function getNavModel(navTree: NavModelItem[], navId: string, fallback?: NavModel, onlyChild = false): NavModel {
  const node = findNavModelItem(navTree, navId);

  if (node) {
    const main = onlyChild ? node : getRootSectionForNode(node);
    const mainWithActive = enrichNodeWithActiveState(main, navId);

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

// TODO: not certain this is what we want, but just to help out with migration
export function getFlattenedNavTree(navTree: NavModelItem[]): NavModelItem[] {
  return navTree.flatMap((navItem) => {
    const children = getFlattenedNavTree(navItem.children ?? []);
    return [navItem, ...children];
  });
}

export function getRootSectionForNode(node: NavModelItem): NavModelItem {
  return node.parentItem && node.parentItem.id !== HOME_NAV_ID ? getRootSectionForNode(node.parentItem) : node;
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

export const getTitleFromNavModel = (navModel: NavModel) => {
  return `${navModel.main.text}${navModel.node.text ? ': ' + navModel.node.text : ''}`;
};
