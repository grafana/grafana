import _ from 'lodash';

export class FolderPageLoader {
  constructor(private backendSrv) {}

  load(ctrl, uid, activeChildId) {
    ctrl.navModel = {
      main: {
        icon: 'fa fa-folder-open',
        id: 'manage-folder',
        subTitle: 'Manage folder dashboards & permissions',
        url: '',
        text: '',
        breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }, { title: ' ' }],
        children: [
          {
            active: activeChildId === 'manage-folder-dashboards',
            icon: 'fa fa-fw fa-th-large',
            id: 'manage-folder-dashboards',
            text: 'Dashboards',
            url: 'dashboards',
          },
          {
            active: activeChildId === 'manage-folder-permissions',
            icon: 'fa fa-fw fa-lock',
            id: 'manage-folder-permissions',
            text: 'Permissions',
            url: 'dashboards/permissions',
          },
          {
            active: activeChildId === 'manage-folder-settings',
            icon: 'fa fa-fw fa-cog',
            id: 'manage-folder-settings',
            text: 'Settings',
            url: 'dashboards/settings',
          },
        ],
      },
    };

    return this.backendSrv.getDashboardByUid(uid).then(result => {
      ctrl.folderId = result.dashboard.id;
      const folderTitle = result.dashboard.title;
      ctrl.navModel.main.text = '';
      ctrl.navModel.main.breadcrumbs = [{ title: 'Dashboards', url: 'dashboards' }, { title: folderTitle }];

      const folderUrl = result.meta.url;

      const dashTab = _.find(ctrl.navModel.main.children, {
        id: 'manage-folder-dashboards',
      });
      dashTab.url = folderUrl;

      const permTab = _.find(ctrl.navModel.main.children, {
        id: 'manage-folder-permissions',
      });
      permTab.url = folderUrl + '/permissions';

      const settingsTab = _.find(ctrl.navModel.main.children, {
        id: 'manage-folder-settings',
      });
      settingsTab.url = folderUrl + '/settings';

      return result;
    });
  }
}
