import { backendSrv } from 'app/core/services/backend_srv';
import { NavModel, NavModelItem } from '@grafana/data';

export const loadFolderPage = (uid: string, activeChildId: string) => {
  const navModel: Pick<NavModel, 'main'> = {
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

  return backendSrv.getFolderByUid(uid).then((folder) => {
    const folderTitle = folder.title;
    const folderUrl = folder.url;

    navModel.main.text = folderTitle;

    const dashTab = navModel.main.children![0]!;
    const permTab = navModel.main.children![1]!;
    const settingsTab = navModel.main.children![2]!;

    settingsTab!.url = folderUrl + '/settings';
    dashTab!.url = folderUrl;
    permTab!.url = folderUrl + '/permissions';

    navModel.main.children = [dashTab];

    if (folder.canAdmin) {
      navModel.main.children.push(permTab);
    }

    if (folder.canEdit) {
      navModel.main.children.push(settingsTab);
    }

    return { folder, model: navModel };
  });
};
