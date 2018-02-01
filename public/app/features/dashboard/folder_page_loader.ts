export class FolderPageLoader {
  constructor(private backendSrv, private $routeParams) {}

  load(ctrl, folderId, activeChildId) {
    ctrl.navModel = {
      main: {
        icon: 'fa fa-folder-open',
        id: 'manage-folder',
        subTitle: 'Manage folder dashboards & permissions',
        url: '',
        text: '',
        breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }],
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

    return this.backendSrv.getDashboard('db', this.$routeParams.slug).then(result => {
      const folderTitle = result.dashboard.title;
      ctrl.navModel.main.text = folderTitle;

      const folderUrl = this.createFolderUrl(folderId, result.meta.slug);
      const dashTab = ctrl.navModel.main.children.find(child => child.id === 'manage-folder-dashboards');
      dashTab.url = folderUrl;

      if (result.meta.canAdmin) {
        const permTab = ctrl.navModel.main.children.find(child => child.id === 'manage-folder-permissions');
        permTab.url = folderUrl + '/permissions';

        const settingsTab = ctrl.navModel.main.children.find(child => child.id === 'manage-folder-settings');
        settingsTab.url = folderUrl + '/settings';
      } else {
        ctrl.navModel.main.children = [dashTab];
      }

      return result;
    });
  }

  createFolderUrl(folderId: number, slug: string) {
    return `dashboards/folder/${folderId}/${slug}`;
  }
}
