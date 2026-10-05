import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useLocation } from 'react-router-dom-v5-compat';

import { type IconName, locationUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';
import { Drawer, useTheme2 } from '@grafana/ui';
import { type OwnerReference } from 'app/api/clients/folder/v1beta1';
import { useCreateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { DASHBOARD_GROUP_COLOR_NAME, ITEM_ICONS } from 'app/core/components/AppChrome/QuickAdd/utils';
import { useAppNotification } from 'app/core/copy/appNotification';
import { NewDashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/analytics/main';
import { CONTENT_KINDS, SOURCE_ENTRY_POINTS } from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { useTemplateDashboardsAvailability } from 'app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { NewProvisionedFolderForm } from 'app/features/provisioning/components/Folders/NewProvisionedFolderForm';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import {
  getImportPhrase,
  getNewDashboardPhrase,
  getNewFolderPhrase,
  getNewTemplateDashboardPhrase,
} from 'app/features/search/tempI18nPhrases';
import { type FolderDTO } from 'app/types/folders';

import { NewFolderForm } from './NewFolderForm';

export interface CreateNewAction {
  id: 'new-dashboard' | 'import' | 'template-dashboard' | 'new-folder';
  group: 'dashboard' | 'folder';
  label: string;
  icon: IconName;
  iconColor?: string;
  url?: string;
  onClick: () => void;
  testId?: string;
}

interface CreateNewActionsOptions {
  parentFolder?: FolderDTO;
  canCreateDashboard: boolean;
  canCreateFolder: boolean;
  onNewFolder: () => void;
}

/**
 * The create actions for a folder, shared by the browse page "New" button and the dashboards
 * section sidebar.
 */
export function useCreateNewActions({
  parentFolder,
  canCreateDashboard,
  canCreateFolder,
  onNewFolder,
}: CreateNewActionsOptions): CreateNewAction[] {
  const location = useLocation();
  const theme = useTheme2();
  const isAnalyticsFrameworkEnabled = useBooleanFlagValue('analyticsFramework', true);
  const isCustomDashboardTemplatesEnabled = useFlagGrafanaCustomDashboardTemplates();
  const { isAvailable: renderPreBuiltDashboardAction } = useTemplateDashboardsAvailability();
  const dashboardIconColor = theme.visualization.getColorByName(DASHBOARD_GROUP_COLOR_NAME);

  const actions: CreateNewAction[] = [];

  if (canCreateDashboard) {
    const newDashboardUrl = buildUrl('/dashboard/new', parentFolder?.uid);
    const importUrl = buildUrl('/dashboard/import', parentFolder?.uid);

    actions.push(
      {
        id: 'new-dashboard',
        group: 'dashboard',
        label: getNewDashboardPhrase(),
        icon: ITEM_ICONS['dashboards/new'],
        iconColor: dashboardIconColor,
        url: newDashboardUrl,
        onClick: () =>
          reportInteraction('grafana_menu_item_clicked', { url: newDashboardUrl, from: location.pathname }),
        testId: selectors.components.CreateNewButton.newDashboardLink,
      },
      {
        id: 'import',
        group: 'dashboard',
        label: getImportPhrase(),
        icon: ITEM_ICONS['dashboards/import'],
        iconColor: dashboardIconColor,
        url: importUrl,
        onClick: () => reportInteraction('grafana_menu_item_clicked', { url: importUrl, from: location.pathname }),
      }
    );

    if (renderPreBuiltDashboardAction) {
      const entryPointArgs = {
        entryPoint: SOURCE_ENTRY_POINTS.BROWSE_DASHBOARDS_PAGE,
        contentKind: isCustomDashboardTemplatesEnabled ? undefined : CONTENT_KINDS.TEMPLATE_DASHBOARD,
        contentKinds: isCustomDashboardTemplatesEnabled
          ? [CONTENT_KINDS.CUSTOM_DASHBOARD_TEMPLATE, CONTENT_KINDS.TEMPLATE_DASHBOARD]
          : [CONTENT_KINDS.TEMPLATE_DASHBOARD],
      };

      actions.push({
        id: 'template-dashboard',
        group: 'dashboard',
        label: getNewTemplateDashboardPhrase(),
        icon: ITEM_ICONS['browse-template-dashboard'],
        iconColor: dashboardIconColor,
        url: buildUrl('/dashboards?templateDashboards=true&source=createNewButton', parentFolder?.uid),
        onClick: () =>
          isAnalyticsFrameworkEnabled
            ? NewDashboardLibraryInteractions.entryPointClicked(entryPointArgs)
            : DashboardLibraryInteractions.entryPointClicked(entryPointArgs),
        testId: selectors.components.CreateNewButton.newTemplateDashboardLink,
      });
    }
  }

  if (canCreateFolder) {
    actions.push({
      id: 'new-folder',
      group: 'folder',
      label: getNewFolderPhrase(),
      icon: ITEM_ICONS['folder'],
      onClick: () => {
        reportInteraction('grafana_browse_dashboards_new_folder_drawer_opened', { from: location.pathname });
        onNewFolder();
      },
    });
  }

  return actions;
}

interface NewFolderDrawerProps {
  parentFolder?: FolderDTO;
  onClose: () => void;
}

export function NewFolderDrawer({ parentFolder, onClose }: NewFolderDrawerProps) {
  const [newFolder] = useCreateFolder();
  const notifyApp = useAppNotification();
  const isProvisionedInstance = useIsProvisionedInstance();

  const onCreateFolder = async (folderName: string, teamOwnerRefs?: OwnerReference[]) => {
    try {
      const folder = await newFolder({
        title: folderName,
        parentUid: parentFolder?.uid,
        teamOwnerReferences: teamOwnerRefs,
      });

      const depth = parentFolder ? (parentFolder.parents?.length || 0) + 1 : 0;
      reportInteraction('grafana_manage_dashboards_folder_created', {
        is_subfolder: Boolean(parentFolder?.uid),
        folder_depth: depth,
      });

      if (!folder.error) {
        notifyApp.success('Folder created');
      } else {
        notifyApp.error('Failed to create folder');
      }

      if (folder.data) {
        locationService.push(locationUtil.stripBaseFromUrl(folder.data.url));
      }
    } finally {
      onClose();
    }
  };

  return (
    <Drawer
      title={getNewFolderPhrase()}
      subtitle={parentFolder?.title ? `Location: ${parentFolder.title}` : undefined}
      onClose={onClose}
      size="sm"
    >
      {isItemManagedByRepository(parentFolder) || isProvisionedInstance ? (
        <NewProvisionedFolderForm onDismiss={onClose} parentFolder={parentFolder} />
      ) : (
        <NewFolderForm onConfirm={onCreateFolder} onCancel={onClose} parentFolder={parentFolder} />
      )}
    </Drawer>
  );
}

/**
 * @param url without any parameters
 * @param folderUid  folder id
 * @returns url with paramter if folder is present
 */
function buildUrl(url: string, folderUid: string | undefined) {
  const baseUrl = folderUid ? url + '?folderUid=' + folderUid : url;
  return config.appSubUrl ? config.appSubUrl + baseUrl : baseUrl;
}
