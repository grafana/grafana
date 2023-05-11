import { NavModel, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, FolderDTO } from 'app/types';

export const getDashboardsTabID = (folderUID: string) => `folder-dashboards-${folderUID}`;
export const getLibraryPanelsTabID = (folderUID: string) => `folder-library-panels-${folderUID}`;
export const getAlertingTabID = (folderUID: string) => `folder-alerting-${folderUID}`;
export const getPermissionsTabID = (folderUID: string) => `folder-permissions-${folderUID}`;
export const getSettingsTabID = (folderUID: string) => `folder-settings-${folderUID}`;

export function buildNavModel(folder: FolderDTO, parents = folder.parents): NavModelItem {
  const model: NavModelItem = {
    icon: 'folder',
    id: 'manage-folder',
    subTitle: 'Manage folder dashboards and permissions',
    url: folder.url,
    text: folder.title,
    children: [
      {
        active: false,
        icon: 'apps',
        id: getDashboardsTabID(folder.uid),
        text: 'Dashboards',
        url: folder.url,
      },
    ],
  };

  if (parents && parents.length > 0) {
    const parent = parents[parents.length - 1];
    const remainingParents = parents.slice(0, parents.length - 1);
    model.parentItem = buildNavModel(parent, remainingParents);
  }

  model.children!.push({
    active: false,
    icon: 'library-panel',
    id: getLibraryPanelsTabID(folder.uid),
    text: 'Panels',
    url: `${folder.url}/library-panels`,
  });

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) && config.unifiedAlertingEnabled) {
    model.children!.push({
      active: false,
      icon: 'bell',
      id: getAlertingTabID(folder.uid),
      text: 'Alert rules',
      url: `${folder.url}/alerting`,
    });
  }

  if (folder.canAdmin) {
    model.children!.push({
      active: false,
      icon: 'lock',
      id: getPermissionsTabID(folder.uid),
      text: 'Permissions',
      url: `${folder.url}/permissions`,
    });
  }

  if (folder.canSave) {
    model.children!.push({
      active: false,
      icon: 'cog',
      id: getSettingsTabID(folder.uid),
      text: 'Settings',
      url: `${folder.url}/settings`,
    });
  }

  return model;
}

export function getLoadingNav(tabIndex: number): NavModel {
  const main = buildNavModel({
    created: '',
    createdBy: '',
    hasAcl: false,
    updated: '',
    updatedBy: '',
    id: 1,
    uid: 'loading',
    title: 'Loading',
    url: 'url',
    canSave: true,
    canEdit: true,
    canAdmin: true,
    canDelete: true,
    version: 0,
  });

  main.children![tabIndex].active = true;

  return {
    main: main,
    node: main.children![tabIndex],
  };
}
