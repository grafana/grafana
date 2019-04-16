import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import _ from 'lodash';

export interface NavModelItem {
  text: string;
  url: string;
  icon?: string;
  img?: string;
  id: string;
  active?: boolean;
  hideFromTabs?: boolean;
  divider?: boolean;
  children: NavModelItem[];
  target?: string;
}

export class NavModel {
  breadcrumbs: NavModelItem[];
  main: NavModelItem;
  node: NavModelItem;

  constructor() {
    this.breadcrumbs = [];
  }
}

export class NavModelSrv {
  navItems: any;

  /** @ngInject */
  constructor() {
    this.navItems = config.bootData.navTree;
  }

  getCfgNode() {
    return _.find(this.navItems, { id: 'cfg' });
  }

  getNav(...args) {
    let children = this.navItems;
    const nav = new NavModel();

    for (const id of args) {
      // if its a number then it's the index to use for main
      if (_.isNumber(id)) {
        nav.main = nav.breadcrumbs[id];
        break;
      }

      const node: any = _.find(children, { id: id });
      nav.breadcrumbs.push(node);
      nav.node = node;
      nav.main = node;
      children = node.children;
    }

    if (nav.main.children) {
      for (const item of nav.main.children) {
        item.active = false;

        if (item.url === nav.node.url) {
          item.active = true;
        }
      }
    }

    return nav;
  }

  getNotFoundNav() {
    const node = {
      text: 'Page not found',
      icon: 'fa fa-fw fa-warning',
      subTitle: '404 Error',
    };

    return {
      breadcrumbs: [node],
      node: node,
      main: node,
    };
  }
}

coreModule.service('navModelSrv', NavModelSrv);
