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

    return {
      node,
      main,
    };
  }

  if (fallback) {
    return fallback;
  }

  return getNotFoundModel();
};

function getSectionRoot(node: NavModelItem): NavModelItem {
  if (!node.parentItem) {
    return node;
  }

  const root = (node.parentItem = { ...node.parentItem });

  if (root.children) {
    root.children = root.children.map((item) => {
      if (item.id === node.id) {
        return { ...node, active: true };
      }

      return item;
    });
  }

  return getSectionRoot(root);
}

export const getTitleFromNavModel = (navModel: NavModel) => {
  return `${navModel.main.text}${navModel.node.text ? ': ' + navModel.node.text : ''}`;
};
