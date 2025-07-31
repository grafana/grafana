import { NavModel, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getNavSubTitle } from 'app/core/utils/navBarItem-translations';
import { AccessControlAction } from 'app/types/accessControl';
import { FolderDTO, FolderParent } from 'app/types/folders';

export const FOLDER_ID = 'manage-folder';

export const getDashboardsTabID = (folderUID: string) => `folder-dashboards-${folderUID}`;
export const getLibraryPanelsTabID = (folderUID: string) => `folder-library-panels-${folderUID}`;
export const getAlertingTabID = (folderUID: string) => `folder-alerting-${folderUID}`;
export const getPermissionsTabID = (folderUID: string) => `folder-permissions-${folderUID}`;
export const getSettingsTabID = (folderUID: string) => `folder-settings-${folderUID}`;

export function buildNavModel(folder: FolderDTO | FolderParent, parentsArg?: FolderParent[]): NavModelItem {
  const parents = parentsArg ?? ('parents' in folder ? folder.parents : undefined);

  const model: NavModelItem = {
    icon: 'folder',
    id: FOLDER_ID,
    subTitle: getNavSubTitle('manage-folder'),
    url: folder.url,
    text: folder.title,
    children: [
      {
        active: false,
        icon: 'apps',
        id: getDashboardsTabID(folder.uid),
        text: t('browse-dashboards.manage-folder-nav.dashboards', 'Dashboards'),
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
    text: t('browse-dashboards.manage-folder-nav.panels', 'Panels'),
    url: `${folder.url}/library-panels`,
  });

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) && config.unifiedAlertingEnabled) {
    model.children!.push({
      active: false,
      icon: 'bell',
      id: getAlertingTabID(folder.uid),
      text: t('browse-dashboards.manage-folder-nav.alert-rules', 'Alert rules'),
      url: `${folder.url}/alerting`,
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
    title: t('folders.get-loading-nav.main.title.loading', 'Loading'),
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
