import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { type NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { getCustomRootFolderItem } from 'app/core/components/NestedFolderPicker/utils';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { ManagerKind } from 'app/features/apiserver/types';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';
import { isItemManagedByRepository } from '../../utils/managedResource';

interface Props extends NestedFolderPickerProps {
  /* Repository name (uid) or undefined (when it's non-provisioned folder). This decides when to show only one provisioned folder */
  repositoryName?: string;
  showAllFolders?: boolean;
}

type Scope = Pick<NestedFolderPickerProps, 'rootFolderUID' | 'rootFolderItem' | 'excludeUIDs' | 'folderFilter'>;

export function ProvisioningAwareFolderPicker({ repositoryName, showAllFolders, ...props }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  const provisioningEnabled = config.provisioningEnabled;
  const { data: settingsData } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);
  const repositories = settingsData?.items;

  const repositoryScope = useMemo<Scope>(
    () =>
      provisioningEnabled && !isProvisionedInstance && !showAllFolders
        ? getRepositoryScope(repositoryName, repositories ?? [])
        : {},
    [provisioningEnabled, isProvisionedInstance, showAllFolders, repositoryName, repositories]
  );

  const excludeUIDs = [...(repositoryScope.excludeUIDs ?? []), ...(props.excludeUIDs ?? [])];

  return <FolderPicker {...props} {...repositoryScope} excludeUIDs={excludeUIDs} />;
}

function getRepositoryScope(repositoryName: string | undefined, repositories: RepositoryView[]): Scope {
  if (!repositoryName) {
    return { excludeUIDs: repositories.map((repository) => repository.name) };
  }

  const repository = repositories.find((item) => item.name === repositoryName);
  if (!repository) {
    return { rootFolderUID: repositoryName };
  }

  const rootFolderUID = repository.target === 'folderless' ? undefined : repository.name;
  // The legacy folder API reports managedBy but not managerId. Inside the repository's own folder every
  // managed child is its own, so a missing id is accepted there. Folderless browsing has no such fence.
  const acceptMissingManagerId = rootFolderUID !== undefined;
  return {
    rootFolderUID,
    rootFolderItem: getCustomRootFolderItem({
      title: repository.title,
      managedBy: ManagerKind.Repo,
      managerId: repository.name,
      uid: rootFolderUID ?? '',
    }),
    folderFilter: (folder) =>
      isItemManagedByRepository(folder) &&
      (folder.managerId === repository.name || (acceptMissingManagerId && folder.managerId === undefined)),
  };
}
