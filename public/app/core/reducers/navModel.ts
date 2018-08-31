import { Action } from 'app/core/actions/navModel';
import { NavModel, NavModelItem } from 'app/types';
import config from 'app/core/config';

function getNotFoundModel(): NavModel {
  var node: NavModelItem = {
    id: 'not-found',
    text: 'Page not found',
    icon: 'fa fa-fw fa-warning',
    subTitle: '404 Error',
    url: 'not-found',
  };

  return {
    breadcrumbs: [node],
    node: node,
    main: node,
  };
}

export const initialState: NavModel = getNotFoundModel();

const navModelReducer = (state = initialState, action: Action): NavModel => {
  switch (action.type) {
    case 'INIT_NAV_MODEL': {
      let children = config.bootData.navTree as NavModelItem[];
      let main, node;
      const parents = [];

      for (const id of action.args) {
        node = children.find(el => el.id === id);

        if (!node) {
          throw new Error(`NavItem with id ${id} not found`);
        }

        children = node.children;
        parents.push(node);
      }

      main = parents[parents.length - 2];

      if (main.children) {
        for (const item of main.children) {
          item.active = false;

          if (item.url === node.url) {
            item.active = true;
          }
        }
      }

      return {
        main: main,
        node: node,
        breadcrumbs: [],
      };
    }
  }

  return state;
};

export default navModelReducer;
