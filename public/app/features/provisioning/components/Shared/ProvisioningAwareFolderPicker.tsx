import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { type NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { getCustomRootFolderItem } from 'app/core/components/NestedFolderPicker/utils';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { ManagerKind } from 'app/features/apiserver/types';
import { type DashboardViewItem } from 'app/features/search/types';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';
import { isItemManagedByRepository } from '../../utils/managedResource';

interface Props extends NestedFolderPickerProps {
  /* Repository name (uid) or undefined (when it's non-provisioned folder). This decides when to show only one provisioned folder */
  repositoryName?: string;
  showAllFolders?: boolean;
}

type Scope = Pick<NestedFolderPickerProps, 'rootFolderUID' | 'rootFolderItem' | 'folderFilter'>;

export function ProvisioningAwareFolderPicker({ repositoryName, showAllFolders, ...props }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  const provisioningEnabled = config.provisioningEnabled;
  const { data: settingsData } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);
  const repositories = settingsData?.items;

  const repositoryScope: Scope =
    provisioningEnabled && !isProvisionedInstance && !showAllFolders
      ? getRepositoryScope(repositoryName, repositories ?? [])
      : {};

  return <FolderPicker {...props} {...repositoryScope} />;
}

function getRepositoryScope(repositoryName: string | undefined, repositories: RepositoryView[]): Scope {
  if (!repositoryName) {
    // Local resources move only between local folders.
    return { folderFilter: (folder) => !isItemManagedByRepository(folder) };
  }

  const repository = repositories.find((item) => item.name === repositoryName);
  if (!repository) {
    return { rootFolderUID: repositoryName };
  }

  const isFolderless = repository.target === 'folderless';
  const ownsFolder = (folder: DashboardViewItem) =>
    isItemManagedByRepository(folder) && folder.managerId === repository.name;
  // Inside the repository folder every managed row is its own, so a row with no id (legacy folder
  // list API) is accepted. Search rows always carry the id, so foreign hits still fail.
  const notForeign = (folder: DashboardViewItem) =>
    isItemManagedByRepository(folder) && (folder.managerId ?? repository.name) === repository.name;
  return {
    rootFolderUID: isFolderless ? undefined : repository.name,
    rootFolderItem: getCustomRootFolderItem({
      title: repository.title,
      managedBy: ManagerKind.Repo,
      managerId: repository.name,
      uid: isFolderless ? '' : repository.name,
    }),
    folderFilter: isFolderless ? ownsFolder : notForeign,
  };
}
