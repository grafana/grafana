import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { type NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { getCustomRootFolderItem } from 'app/core/components/NestedFolderPicker/utils';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { ManagerKind } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

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

  const scope = useMemo<Scope>(() => {
    const repositoryScope =
      provisioningEnabled && !isProvisionedInstance && !showAllFolders
        ? getRepositoryScope(repositoryName, repositories ?? [])
        : {};

    return {
      ...repositoryScope,
      excludeUIDs: [...(repositoryScope.excludeUIDs ?? []), ...(props.excludeUIDs ?? [])],
    };
  }, [provisioningEnabled, isProvisionedInstance, showAllFolders, repositoryName, repositories, props.excludeUIDs]);

  return <FolderPicker {...props} {...scope} />;
}

function getRepositoryScope(repositoryName: string | undefined, repositories: RepositoryView[]): Scope {
  if (!repositoryName) {
    return { excludeUIDs: repositories.map((repository) => repository.name) };
  }

  const repository = repositories.find((item) => item.name === repositoryName);
  if (!repository) {
    return { rootFolderUID: repositoryName };
  }

  const isFolderless = repository.target === 'folderless';
  const rootFolderItem = getCustomRootFolderItem({
    title: repository.title,
    managedBy: ManagerKind.Repo,
    managerId: repository.name,
    uid: isFolderless ? '' : repository.name,
  });

  if (isFolderless) {
    // An explicit root hides team, starred, and shared-with-me virtual roots, which are not repository destinations.
    return {
      rootFolderUID: GENERAL_FOLDER_UID,
      rootFolderItem,
      folderFilter: (folder) => folder.managedBy === ManagerKind.Repo && folder.managerId === repository.name,
    };
  }

  return { rootFolderUID: repository.name, rootFolderItem };
}
