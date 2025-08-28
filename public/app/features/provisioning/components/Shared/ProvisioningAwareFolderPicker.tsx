import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { RepositoryViewList, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

interface Props extends NestedFolderPickerProps {
  /* Repository name (uid) or undefined (when it's non-provisioned folder). This decides when to show only one provisioned folder */
  repositoryName?: string;
  showAllFolders?: boolean;
}

export function ProvisioningAwareFolderPicker({ repositoryName, showAllFolders, ...props }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  const provisioningEnabled = config.featureToggles.provisioning;
  const { data: settingsData } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);
  const isNonProvisionedResource = !repositoryName;

  const rootFolderUID = getRootFolderUID({
    isProvisionedInstance,
    provisioningEnabled,
    repositoryName,
  });
  const excludeUIDs = getExcludeUIDs({
    isProvisionedInstance,
    isNonProvisionedResource,
    provisioningEnabled,
    settingsData,
  });

  return (
    <FolderPicker
      {...props}
      rootFolderUID={showAllFolders ? undefined : rootFolderUID}
      excludeUIDs={showAllFolders ? undefined : [...excludeUIDs, ...(props.excludeUIDs || [])]}
    />
  );
}

function getRootFolderUID({
  isProvisionedInstance,
  provisioningEnabled,
  repositoryName,
}: {
  isProvisionedInstance?: boolean;
  provisioningEnabled?: boolean;
  repositoryName?: string;
}) {
  if (isProvisionedInstance) {
    return undefined;
  }

  if (provisioningEnabled && repositoryName) {
    return repositoryName;
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
    // If provisioning is enabled, we want to exclude all provisionedfolders
    return settingsData?.items.map((repo) => repo.name) || [];
  }

  return [];
}
