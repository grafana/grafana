import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import {
  type RepositoryView,
  type RepositoryViewList,
  useGetFrontendSettingsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { type NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { getCustomRootFolderItem } from 'app/core/components/NestedFolderPicker/utils';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { ManagerKind } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { type DashboardViewItem } from 'app/features/search/types';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

interface Props extends NestedFolderPickerProps {
  /* Repository name (uid) or undefined (when it's non-provisioned folder). This decides when to show only one provisioned folder */
  repositoryName?: string;
  repositoryTarget?: RepositoryView['target'];
  showAllFolders?: boolean;
}

export function ProvisioningAwareFolderPicker({ repositoryName, repositoryTarget, showAllFolders, ...props }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  const provisioningEnabled = config.provisioningEnabled;
  const { data: settingsData } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);
  const isNonProvisionedResource = !repositoryName;
  const repository = settingsData?.items.find((item) => item.name === repositoryName);
  const resolvedRepositoryTarget = repositoryTarget ?? repository?.target;

  const rootFolderUID = getRootFolderUID({
    isProvisionedInstance,
    provisioningEnabled,
    repositoryName,
    repositoryTarget: resolvedRepositoryTarget,
  });
  const excludeUIDs = getExcludeUIDs({
    isProvisionedInstance,
    isNonProvisionedResource,
    provisioningEnabled,
    settingsData,
  });
  const rootFolderDisplayItem = getRootFolderDisplayItem({
    isProvisionedInstance,
    repository,
    repositoryTarget: resolvedRepositoryTarget,
  });
  const folderFilter = useMemo(
    () => getFolderFilter(repositoryName, resolvedRepositoryTarget),
    [repositoryName, resolvedRepositoryTarget]
  );

  return (
    <FolderPicker
      {...props}
      rootFolderUID={showAllFolders ? undefined : rootFolderUID}
      excludeUIDs={showAllFolders ? undefined : [...excludeUIDs, ...(props.excludeUIDs || [])]}
      rootFolderItem={showAllFolders ? undefined : rootFolderDisplayItem}
      folderFilter={showAllFolders ? undefined : folderFilter}
    />
  );
}

function getRootFolderUID({
  isProvisionedInstance,
  provisioningEnabled,
  repositoryName,
  repositoryTarget,
}: {
  isProvisionedInstance?: boolean;
  provisioningEnabled?: boolean;
  repositoryName?: string;
  repositoryTarget?: RepositoryView['target'];
}) {
  if (isProvisionedInstance) {
    return undefined;
  }

  if (provisioningEnabled && repositoryName) {
    return repositoryTarget === 'folderless' ? GENERAL_FOLDER_UID : repositoryName;
  }

  return undefined;
}

function getExcludeUIDs({
  isProvisionedInstance,
  isNonProvisionedResource,
  provisioningEnabled,
  settingsData,
}: {
  isProvisionedInstance?: boolean;
  isNonProvisionedResource?: boolean;
  provisioningEnabled?: boolean;
  settingsData?: RepositoryViewList;
}) {
  if (isProvisionedInstance) {
    return [];
  }

  if (isNonProvisionedResource) {
    // If provisioning is disabled, we don't want to exclude any folders
    if (!provisioningEnabled) {
      return [];
    }
    // If provisioning is enabled, we want to exclude all provisioned folders
    return settingsData?.items.map((repo) => repo.name) || [];
  }

  return [];
}

function getRootFolderDisplayItem({
  isProvisionedInstance,
  repository,
  repositoryTarget,
}: {
  isProvisionedInstance?: boolean;
  repository?: RepositoryView;
  repositoryTarget?: RepositoryView['target'];
}) {
  if (isProvisionedInstance) {
    // If it's a provisioned instance, we use default root display ("Dashboards")
    return undefined;
  }

  return repository
    ? getCustomRootFolderItem({
        title: repository.title,
        uid: repositoryTarget === 'folderless' ? undefined : repository.name,
        managedBy: ManagerKind.Repo,
      })
    : undefined;
}

function getFolderFilter(
  repositoryName?: string,
  repositoryTarget?: RepositoryView['target']
): ((folder: DashboardViewItem) => boolean) | undefined {
  if (!repositoryName || repositoryTarget !== 'folderless') {
    return undefined;
  }

  return (folder) => folder.managedBy === ManagerKind.Repo && folder.managerId === repositoryName;
}
