import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { RepositoryViewList, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

interface Props extends NestedFolderPickerProps {
  /* repo name (uid) or undefined (when it's non-provisioned folder). This decides when to show only one provision folder*/
  repositoryName?: string;
  /* this decides when to exclude provisioned folders*/
  isNonProvisionedFolder?: boolean;
}

export function ProvisioningAwareFolderPicker({ repositoryName, isNonProvisionedFolder, ...props }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  const provisioningEnabled = config.featureToggles.provisioning;
  const { data: settingsData } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);

  const rootFolderUID = getRootFolderUID(isProvisionedInstance, provisioningEnabled, repositoryName);
  const excludeUIDs = getExcludeUIDs(isProvisionedInstance, isNonProvisionedFolder, provisioningEnabled, settingsData);

  return (
    <FolderPicker
      {...props}
      rootFolderUID={rootFolderUID}
      excludeUIDs={[...excludeUIDs, ...(props.excludeUIDs || [])]}
    />
  );
}

function getRootFolderUID(isProvisionedInstance?: boolean, provisioningEnabled?: boolean, repositoryName?: string) {
  if (isProvisionedInstance) {
    return undefined;
  }

  if (provisioningEnabled && repositoryName) {
    return repositoryName;
  }

  return undefined;
}

function getExcludeUIDs(
  isProvisionedInstance?: boolean,
  isNonProvisionedFolder?: boolean,
  provisioningEnabled?: boolean,
  settingsData?: RepositoryViewList
) {
  if (isProvisionedInstance) {
    return [];
  }

  if (isNonProvisionedFolder) {
    if (!provisioningEnabled) {
      return [];
    }
    return settingsData?.items.map((repo) => repo.name) || [];
  }

  return [];
}
