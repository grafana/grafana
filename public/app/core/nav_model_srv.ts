///<reference path="../headers/common.d.ts" />

import coreModule from 'app/core/core_module';

export interface NavModelItem {
  title: string;
  url: string;
  icon?: string;
  iconUrl?: string;
}

export interface NavModel {
  section: NavModelItem;
  menu: NavModelItem[];
}

export class NavModelSrv {


  /** @ngInject */
  constructor(private contextSrv) {
  }

  getAlertingNav(subPage) {
    return {
      section: {
        title: 'Alerting',
        url: 'plugins',
        icon: 'icon-gf icon-gf-alert'
      },
      menu: [
        {title: 'Alert List', active: subPage === 0, url: 'alerting/list', icon: 'fa fa-list-ul'},
        {title: 'Notification channels', active: subPage === 1, url: 'alerting/notifications', icon: 'fa fa-bell-o'},
      ]
    };
  }

  getDatasourceNav(subPage) {
    return {
      section: {
        title: 'Data Sources',
        url: 'datasources',
        icon: 'icon-gf icon-gf-datasources'
      },
      menu: [
        {title: 'List view', active: subPage === 0, url: 'datasources', icon: 'fa fa-list-ul'},
        {title: 'Add data source', active: subPage === 1, url: 'datasources/new', icon: 'fa fa-plus'},
      ]
    };
  }

  getPlaylistsNav(subPage) {
    return {
      section: {
        title: 'Playlists',
        url: 'playlists',
        icon: 'fa fa-fw fa-film'
      },
      menu: [
        {title: 'List view', active: subPage === 0, url: 'playlists', icon: 'fa fa-list-ul'},
        {title: 'Add Playlist', active: subPage === 1, url: 'playlists/create', icon: 'fa fa-plus'},
      ]
    };
  }

  getProfileNav() {
    return {
      section: {
        title: 'User Profile',
        url: 'profile',
        icon: 'fa fa-fw fa-user'
      },
      menu: []
    };
  }

  getNotFoundNav() {
    return {
      section: {
        title: 'Page',
        url: '',
        icon: 'fa fa-fw fa-warning'
      },
      menu: []
    };
  }

  getOrgNav(subPage) {
    return {
      section: {
        title: 'Organization',
        url: 'org',
        icon: 'icon-gf icon-gf-users'
      },
      menu: [
        {title: 'Preferences', active: subPage === 0, url: 'org', icon: 'fa fa-fw fa-cog'},
        {title: 'Org Users', active: subPage === 1, url: 'org/users', icon: 'fa fa-fw fa-users'},
        {title: 'API Keys', active: subPage === 2, url: 'org/apikeys', icon: 'fa fa-fw fa-key'},
      ]
    };
  }

  getAdminNav(subPage) {
    return {
      section: {
        title: 'Admin',
        url: 'admin',
        icon: 'fa fa-fw fa-cogs'
      },
      menu: [
        {title: 'Users', active: subPage === 0, url: 'admin/users', icon: 'fa fa-fw fa-user'},
        {title: 'Orgs', active: subPage === 1, url: 'admin/orgs', icon: 'fa fa-fw fa-users'},
        {title: 'Server Settings', active: subPage === 2, url: 'admin/settings', icon: 'fa fa-fw fa-cogs'},
        {title: 'Server Stats', active: subPage === 2, url: 'admin/stats', icon: 'fa fa-fw fa-line-chart'},
        {title: 'Style Guide', active: subPage === 2, url: 'styleguide', icon: 'fa fa-fw fa-key'},
      ]
    };
  }

  getPluginsNav() {
    return {
      section: {
        title: 'Plugins',
        url: 'plugins',
        icon: 'icon-gf icon-gf-apps'
      },
      menu: []
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
        icon: 'fa fa-fw fa-bolt',
        clickHandler: () => dashNavCtrl.openEditView('annotations')
      });

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

    menu.push({
      title: 'Shortcuts',
      icon: 'fa fa-fw fa-keyboard-o',
      clickHandler: () => dashNavCtrl.showHelpModal()
    });

    if (this.contextSrv.isEditor) {
      menu.push({
        title: 'Save As ...',
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
