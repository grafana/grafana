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
    const nodeWithActive = enrichNodeWithActiveState(node);
    const main = onlyChild ? nodeWithActive : getSectionRoot(nodeWithActive);

    return {
      node: nodeWithActive,
      main,
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

function enrichNodeWithActiveState(node: NavModelItem): NavModelItem {
  const nodeCopy = { ...node };

  if (nodeCopy.parentItem) {
    nodeCopy.parentItem = { ...nodeCopy.parentItem };
    const root = nodeCopy.parentItem;

    if (root.children) {
      root.children = root.children.map((item) => {
        if (item.id === node.id) {
          return { ...nodeCopy, active: true };
        }

        return item;
      });
    }

    nodeCopy.parentItem = enrichNodeWithActiveState(root);
  }

  return nodeCopy;
}

export const getTitleFromNavModel = (navModel: NavModel) => {
  return `${navModel.main.text}${navModel.node.text ? ': ' + navModel.node.text : ''}`;
};
