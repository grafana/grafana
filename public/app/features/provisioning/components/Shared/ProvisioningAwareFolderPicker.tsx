import {
  type RepositoryView,
  type RepositoryViewList,
  useGetFrontendSettingsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { type NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { getCustomRootFolderItem } from 'app/core/components/NestedFolderPicker/utils';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { ManagerKind } from 'app/features/apiserver/types';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

interface Props extends NestedFolderPickerProps {
  /* Repository name (uid) or undefined (when it's non-provisioned folder). This decides when to show only one provisioned folder */
  repositoryName?: string;
  showAllFolders?: boolean;
}

export function ProvisioningAwareFolderPicker({ repositoryName, showAllFolders, ...props }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  const { data: settingsData } = useGetFrontendSettingsQuery(undefined);
  const isNonProvisionedResource = !repositoryName;

  const rootFolderUID = getRootFolderUID({
    isProvisionedInstance,
    repositoryName,
  });
  const excludeUIDs = getExcludeUIDs({
    isProvisionedInstance,
    isNonProvisionedResource,
    settingsData,
  });
  const rootFolderDisplayItem = getRootFolderDisplayItem({
    isProvisionedInstance,
    rootFolderUID,
    settingsDataItem: settingsData?.items,
  });

  return (
    <FolderPicker
      {...props}
      rootFolderUID={showAllFolders ? undefined : rootFolderUID}
      excludeUIDs={showAllFolders ? undefined : [...excludeUIDs, ...(props.excludeUIDs || [])]}
      rootFolderItem={showAllFolders ? undefined : rootFolderDisplayItem}
    />
  );
}

function getRootFolderUID({
  isProvisionedInstance,
  repositoryName,
}: {
  isProvisionedInstance?: boolean;
  repositoryName?: string;
}) {
  if (isProvisionedInstance) {
    return undefined;
  }

  if (repositoryName) {
    return repositoryName;
  }

  return undefined;
}

function getExcludeUIDs({
  isProvisionedInstance,
  isNonProvisionedResource,
  settingsData,
}: {
  isProvisionedInstance?: boolean;
  isNonProvisionedResource?: boolean;
  settingsData?: RepositoryViewList;
}) {
  if (isProvisionedInstance) {
    return [];
  }

  if (isNonProvisionedResource) {
    return settingsData?.items.map((repo) => repo.name) || [];
  }

  return [];
}

function getRootFolderDisplayItem({
  isProvisionedInstance,
  rootFolderUID,
  settingsDataItem,
}: {
  isProvisionedInstance?: boolean;
  rootFolderUID?: string;
  settingsDataItem?: RepositoryView[];
}) {
  if (isProvisionedInstance) {
    // If it's a provisioned instance, we use default root display ("Dashboards")
    return undefined;
  }

  const repoFolder = settingsDataItem?.find((item: RepositoryView) => item.name === rootFolderUID);
  return repoFolder
    ? getCustomRootFolderItem({ title: repoFolder.title, uid: repoFolder.name, managedBy: ManagerKind.Repo })
    : undefined;
}
