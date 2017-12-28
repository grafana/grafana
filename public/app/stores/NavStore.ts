import { types, getEnv } from 'mobx-state-tree';
import _ from 'lodash';

export const NavItem = types.model('NavItem', {
  id: types.identifier(types.string),
  text: types.string,
  url: types.optional(types.string, ''),
  subTitle: types.optional(types.string, ''),
  icon: types.optional(types.string, ''),
  img: types.optional(types.string, ''),
  active: types.optional(types.boolean, false),
  children: types.optional(types.array(types.late(() => NavItem)), []),
});

export const NavStore = types
  .model('NavStore', {
    main: types.maybe(NavItem),
    node: types.maybe(NavItem),
  })
  .actions(self => ({
    load(...args) {
      var children = getEnv(self).navTree;
      let main, node;
      let parents = [];

      for (let id of args) {
        // if its a number then it's the index to use for main
        if (_.isNumber(id)) {
          main = parents[id];
          break;
        }

        node = _.find(children, { id: id });
        main = node;
        children = node.children;
        parents.push(node);
      }

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
