import { NavModel, NavModelItem } from '@grafana/data';
import coreModule from 'app/angular/core_module';
import config from 'app/core/config';

interface Nav {
  breadcrumbs: NavModelItem[];
  node?: NavModelItem;
  main?: NavModelItem;
}

export class NavModelSrv {
  navItems: NavModelItem[];

  constructor() {
    this.navItems = config.bootData.navTree;
  }

  getCfgNode() {
    return this.navItems.find((navItem) => navItem.id === 'cfg');
  }

  getNav(...args: Array<string | number>) {
    let children = this.navItems;
    const nav: Nav = {
      breadcrumbs: [],
    };

    for (const id of args) {
      // if its a number then it's the index to use for main
      if (typeof id === 'number') {
        nav.main = nav.breadcrumbs[id];
        break;
      }

      const node = children.find((child) => child.id === id);
      if (node) {
        nav.breadcrumbs.push(node);
        nav.node = node;
        nav.main = node;
        children = node.children ?? [];
      }
    }

    if (nav.main?.children) {
      for (const item of nav.main.children) {
        item.active = item.url === nav.node?.url;
      }
    }

    return nav;
  }

  getNotFoundNav() {
    return getNotFoundNav(); // the exported function
  }
}

export function getExceptionNav(error: any): NavModel {
  console.error(error);
  return getWarningNav('Exception thrown', 'See console for details');
}

export function getNotFoundNav(): NavModel {
  return getWarningNav('Page not found', '404 Error');
}

export function getWarningNav(text: string, subTitle?: string): NavModel {
  const node: NavModelItem = {
    text,
    subTitle,
    icon: 'exclamation-triangle',
  };
  return {
    node: node,
    main: node,
  };
}

coreModule.service('navModelSrv', NavModelSrv);
