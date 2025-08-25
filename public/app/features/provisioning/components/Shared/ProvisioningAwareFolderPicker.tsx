import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { NestedFolderPickerProps } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

interface Props extends NestedFolderPickerProps {
  /* repo name (uid) or undefined (when it's non-provisioned folder)*/
  repositoryName?: string;
  isNonProvisionedFolder?: boolean;
}

export function ProvisioningAwareFolderPicker({ repositoryName, isNonProvisionedFolder, ...props }: Props) {
  const isProvisionedInstance = useIsProvisionedInstance();
  const provisioningEnabled = config.featureToggles.provisioning;
  const { data: settingsData } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);

  const rootFolderUID = useMemo(() => {
    if (isProvisionedInstance) {
      // when whole instance is provisioned, root folder is not restricted
      return undefined;
    }

    if (provisioningEnabled && repositoryName) {
      // when whole instance is not provisioned, root folder is restricted
      return repositoryName;
    }

    return undefined;
  }, [isProvisionedInstance, provisioningEnabled, repositoryName]);

  const excludeUIDs = useMemo(() => {
    if (isProvisionedInstance) {
      // when all instance is provisioned, don't exclude any folders
      return [];
    }
    if (isNonProvisionedFolder) {
      if (!provisioningEnabled) {
        // if provisioning is not enabled, don't exclude any folders
        return [];
      }
      // exclude all provisioned folders
      return settingsData?.items.map((repo) => repo.name) || [];
    }
    return [];
  }, [isNonProvisionedFolder, settingsData, isProvisionedInstance, provisioningEnabled]);

  return (
    <FolderPicker
      {...props}
      rootFolderUID={rootFolderUID}
      excludeUIDs={[...excludeUIDs, ...(props.excludeUIDs || [])]}
    />
  );
}
