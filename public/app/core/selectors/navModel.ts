import { NavModel, NavModelItem, NavIndex } from '@grafana/data';

function getNotFoundModel(): NavModel {
  const node: NavModelItem = {
    id: 'not-found',
    text: 'Page not found',
    icon: 'fa fa-fw fa-warning',
    subTitle: '404 Error',
    url: 'not-found',
  };

  return {
    node: node,
    main: node,
  };
}

export function getNavModel(navIndex: NavIndex, id: string, fallback?: NavModel, onlyChild = false): NavModel {
  if (navIndex[id]) {
    const node = navIndex[id];

    let main: NavModelItem;
    if (!onlyChild) {
      main = { ...node.parentItem };

      main.children = main.children.map(item => {
        return {
          ...item,
          active: item.url === node.url,
        };
      });
    } else {
      main = node;
    }

    return {
      node: node,
      main: main,
    };
  }

  if (fallback) {
    return fallback;
  }

  return getNotFoundModel();
}

export const getTitleFromNavModel = (navModel: NavModel) => {
  return `${navModel.main.text}${navModel.node.text ? ': ' + navModel.node.text : ''}`;
};
