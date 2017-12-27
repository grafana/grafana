import { types } from 'mobx-state-tree';
import config from 'app/core/config';
import _ from 'lodash';

export const NavItem = types.model('NavItem', {
  id: types.identifier(types.string),
  text: types.string,
  url: types.optional(types.string, ''),
  description: types.optional(types.string, ''),
  icon: types.optional(types.string, ''),
  img: types.optional(types.string, ''),
  active: types.optional(types.boolean, false),
  children: types.optional(types.array(types.late(() => NavItem)), []),
});

export const NavStore = types
  .model('NavStore', {
    main: types.maybe(NavItem),
    node: types.maybe(NavItem),
    breadcrumbs: types.optional(types.array(NavItem), []),
  })
  .actions(self => ({
    load(...args) {
      var children = config.bootData.navTree;
      let main, node;
      let breadcrumbs = [];

      for (let id of args) {
        // if its a number then it's the index to use for main
        if (_.isNumber(id)) {
          main = breadcrumbs[id];
          break;
        }

        let current = _.find(children, { id: id });
        breadcrumbs.push(current);
        main = node;
        node = current;
        children = node.children;
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

      for (let item of breadcrumbs) {
        self.breadcrumbs.push(NavItem.create(item));
      }

      // self.main = NavItem.create({
      //   id: 'test',
      //   text: 'test',
      //   url: '/test';
      //   children: [
      //     {
      //       id: 'test',
      //       text: 'text',
      //       url: '/test',
      //       active: true,
      //       children: []
      //     }
      //   ]
      // });
    },
  }));
