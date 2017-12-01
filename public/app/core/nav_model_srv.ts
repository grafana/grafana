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
  children: NavModelItem[];
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
  constructor(private contextSrv) {
    this.navItems = config.bootData.navTree;
  }

  getCfgNode() {
    return _.find(this.navItems, {id: 'cfg'});
  }

  getNav(...args) {
    var children = this.navItems;
    var nav = new NavModel();

    for (let id of args) {
      // if its a number then it's the index to use for main
      if (_.isNumber(id)) {
        nav.main = nav.breadcrumbs[id];
        break;
      }

      let node = _.find(children, {id: id});
      nav.breadcrumbs.push(node);
      nav.node = node;
      nav.main = node;
      children = node.children;
    }

    if (nav.main.children) {
      for (let item of nav.main.children) {
        item.active = false;

        if (item.url === nav.node.url) {
          item.active = true;
        }
      }
    }

    return nav;
  }

  getNotFoundNav() {
    var node = {
      text: "Page not found ",
      icon: "fa fa-fw fa-warning",
    };

    return {
      breadcrumbs: [node],
      node: node
    };
  }

  getDashboardNav(dashboard, dashNavCtrl) {
    // special handling for snapshots
    if (dashboard.meta.isSnapshot) {
      return {
        section: {
          title: dashboard.title,
          icon: 'icon-gf icon-gf-snapshot'
        },
        menu: [
          {
            title: 'Go to original dashboard',
            icon: 'fa fa-fw fa-external-link',
            url: dashboard.snapshot.originalUrl,
          }
        ]
      };
    }

    var menu = [];

    if (dashboard.meta.canEdit) {
      menu.push({
        title: 'Settings',
        icon: 'fa fa-fw fa-cog',
        clickHandler: () => dashNavCtrl.openEditView('settings')
      });

      menu.push({
        title: 'Templating',
        icon: 'fa fa-fw fa-code',
        clickHandler: () => dashNavCtrl.openEditView('templating')
      });

      menu.push({
        title: 'Annotations',
        icon: 'fa fa-fw fa-comment',
        clickHandler: () => dashNavCtrl.openEditView('annotations')
      });

      if (dashboard.meta.canAdmin) {
        menu.push({
          title: 'Permissions...',
          icon: 'fa fa-fw fa-lock',
          clickHandler: () => dashNavCtrl.openEditView('permissions')
        });
      }

      if (!dashboard.meta.isHome) {
        menu.push({
          title: 'Version history',
          icon: 'fa fa-fw fa-history',
          clickHandler: () => dashNavCtrl.openEditView('history')
        });
      }

      menu.push({
        title: 'View JSON',
        icon: 'fa fa-fw fa-eye',
        clickHandler: () => dashNavCtrl.viewJson()
      });
    }

    if (this.contextSrv.isEditor && !dashboard.editable) {
      menu.push({
        title: 'Make Editable',
        icon: 'fa fa-fw fa-edit',
        clickHandler: () => dashNavCtrl.makeEditable()
      });
    }

    if (this.contextSrv.isEditor && !dashboard.meta.isFolder) {
      menu.push({
        title: 'Save As...',
        icon: 'fa fa-fw fa-save',
        clickHandler: () => dashNavCtrl.saveDashboardAs()
      });
    }

    if (dashboard.meta.canSave) {
      menu.push({
        title: 'Delete',
        icon: 'fa fa-fw fa-trash',
        clickHandler: () => dashNavCtrl.deleteDashboard()
      });

    }

    return {
      section: {
        title: dashboard.title,
        icon: 'icon-gf icon-gf-dashboard'
      },
      menu: menu
    };
  }
}

coreModule.service('navModelSrv', NavModelSrv);
