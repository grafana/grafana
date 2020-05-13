import { backendSrv } from 'app/core/services/backend_srv';

export const loadFolderPage = (uid: string, activeChildId: string) => {
  const navModel = {
    main: {
      icon: 'folder-open',
      id: 'manage-folder',
      subTitle: 'Manage folder dashboards & permissions',
      url: '',
      text: '',
      breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }],
      children: [
        {
          active: activeChildId === 'manage-folder-dashboards',
          icon: 'th-large',
          id: 'manage-folder-dashboards',
          text: 'Dashboards',
          url: 'dashboards',
        },
        {
          active: activeChildId === 'manage-folder-permissions',
          icon: 'lock',
          id: 'manage-folder-permissions',
          text: 'Permissions',
          url: 'dashboards/permissions',
        },
        {
          active: activeChildId === 'manage-folder-settings',
          icon: 'cog',
          id: 'manage-folder-settings',
          text: 'Settings',
          url: 'dashboards/settings',
        },
      ],
    },
  };

  return backendSrv.getFolderByUid(uid).then((folder: any) => {
    const folderTitle = folder.title;
    const folderUrl = folder.url;
    navModel.main.text = folderTitle;

    const dashTab = navModel.main.children.find((child: any) => child.id === 'manage-folder-dashboards');
    dashTab!.url = folderUrl;

    if (folder.canAdmin) {
      const permTab = navModel.main.children.find((child: any) => child.id === 'manage-folder-permissions');
      permTab!.url = folderUrl + '/permissions';

      const settingsTab = navModel.main.children.find((child: any) => child.id === 'manage-folder-settings');
      settingsTab!.url = folderUrl + '/settings';
    } else {
      navModel.main.children = [dashTab!];
    }

    return { folder, model: navModel };
  });
};
