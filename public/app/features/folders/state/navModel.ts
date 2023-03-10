import { NavModel, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, FolderDTO } from 'app/types';

export function buildNavModel(folder: FolderDTO, parentItem?: NavModelItem): NavModelItem {
  const model: NavModelItem = {
    icon: 'folder',
    id: 'manage-folder',
    parentItem,
    subTitle: 'Manage folder dashboards and permissions',
    url: folder.url,
    text: folder.title,
    breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }],
    children: [
      {
        active: false,
        icon: 'apps',
        id: `folder-dashboards-${folder.uid}`,
        text: 'Dashboards',
        url: folder.url,
        hideFromBreadcrumbs: true,
      },
    ],
  };

  model.children!.push({
    active: false,
    icon: 'library-panel',
    id: `folder-library-panels-${folder.uid}`,
    text: 'Panels',
    url: `${folder.url}/library-panels`,
    hideFromBreadcrumbs: true,
  });

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) && config.unifiedAlertingEnabled) {
    model.children!.push({
      active: false,
      icon: 'bell',
      id: `folder-alerting-${folder.uid}`,
      text: 'Alert rules',
      url: `${folder.url}/alerting`,
      hideFromBreadcrumbs: true,
    });
  }

  if (folder.canAdmin) {
    model.children!.push({
      active: false,
      icon: 'lock',
      id: `folder-permissions-${folder.uid}`,
      text: 'Permissions',
      url: `${folder.url}/permissions`,
      hideFromBreadcrumbs: true,
    });
  }

  if (folder.canSave) {
    model.children!.push({
      active: false,
      icon: 'cog',
      id: `folder-settings-${folder.uid}`,
      text: 'Settings',
      url: `${folder.url}/settings`,
      hideFromBreadcrumbs: true,
    });
  }

  return model;
}

export function getLoadingNav(tabIndex: number): NavModel {
  const main = buildNavModel({
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
