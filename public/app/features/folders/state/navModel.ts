import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getNavSubTitle } from 'app/core/utils/navBarItem-translations';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { AccessControlAction } from 'app/types/accessControl';
import { type FolderDTO, type FolderParent } from 'app/types/folders';

export const FOLDER_ID = 'manage-folder';

export const getDashboardsTabID = (folderUID: string) => `folder-dashboards-${folderUID}`;
export const getLibraryPanelsTabID = (folderUID: string) => `folder-library-panels-${folderUID}`;
export const getAlertingTabID = (folderUID: string) => `folder-alerting-${folderUID}`;

export function buildNavModel(folder: FolderDTO | FolderParent, parentsArg?: FolderParent[]): NavModelItem {
  const parents = parentsArg ?? ('parents' in folder ? folder.parents : undefined);
  const isProvisioned = 'managedBy' in folder && isItemManagedByRepository(folder);

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

  if (!isProvisioned) {
    model.children!.push({
      active: false,
      icon: 'library-panel',
      id: getLibraryPanelsTabID(folder.uid),
      text: t('browse-dashboards.manage-folder-nav.panels', 'Panels'),
      url: `${folder.url}/library-panels`,
    });
  }

  if (
    !isProvisioned &&
    contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) &&
    config.unifiedAlertingEnabled
  ) {
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
