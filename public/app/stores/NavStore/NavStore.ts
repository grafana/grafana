import { types, getEnv } from 'mobx-state-tree';
import { NavItem } from './NavItem';

export const NavStore = types
  .model('NavStore', {
    main: types.maybe(NavItem),
    node: types.maybe(NavItem),
  })
  .actions(self => ({
    load(...args) {
      let children = getEnv(self).navTree;
      let main, node;
      let parents = [];

      for (let id of args) {
        node = children.find(el => el.id === id);

        if (!node) {
          throw new Error(`NavItem with id ${id} not found`);
        }

        children = node.children;
        parents.push(node);
      }

      main = parents[parents.length - 2];

      if (main.children) {
        for (let item of main.children) {
          item.active = false;

          if (item.url === node.url) {
            item.active = true;
          }
        }
      }

      self.main = NavItem.create(main);
      self.node = NavItem.create(node);
    },
  }));
