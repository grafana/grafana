import { NavModel, NavModelItem, NavIndex } from '@grafana/data';

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

export const getNavModel = (navIndex: NavIndex, id: string, fallback?: NavModel, onlyChild = false): NavModel => {
  if (navIndex[id]) {
    const node = navIndex[id];
    const main = onlyChild ? node : getSectionRoot(node);
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
};

function getSectionRoot(node: NavModelItem): NavModelItem {
  return node.parentItem ? getSectionRoot(node.parentItem) : node;
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
