import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';

import { ModeOption } from '../types';

/**
 * Filters available mode options based on system state
 */
function filterModeOptions(modeOptions: ModeOption[], repoName: string, settings?: RepositoryViewList): ModeOption[] {
  const folderConnected = settings?.items?.some((item) => item.target === 'folder' && item.name !== repoName);

  return modeOptions.filter((option) => {
    if (settings?.legacyStorage) {
      return option.target === 'instance';
    }

    if (option.target === 'folder') {
      return true;
    }

    if (option.target === 'instance') {
      return !folderConnected;
    }

    return false;
  });
}

/**
 * Hook that provides filtered mode options
 * This needs to be a hook, so we can add translations
 */
export function useModeOptions(repoName: string, settings?: RepositoryViewList) {
  return useMemo(() => {
    const modeOptions: ModeOption[] = [
      {
        target: 'instance',
        label: t('provisioning.mode-options.instance.label', 'Sync all resources with external storage'),
        description: t(
          'provisioning.mode-options.instance.description',
          'Resources will be synced with external storage and provisioned into this instance. Existing Grafana resources will be migrated and merged if needed. After setup, all new resources and changes will be saved to external storage and automatically provisioned back into the instance.'
        ),
        subtitle: t(
          'provisioning.mode-options.instance.subtitle',
          'Use this option if you want to sync and manage your entire Grafana instance through external storage.'
        ),
      },
      {
        target: 'folder',
        label: t('provisioning.mode-options.folder.label', 'Sync external storage to a new Grafana folder'),
        description: t(
          'provisioning.mode-options.folder.description',
          'After setup, a new Grafana folder will be created and synced with external storage. If any resources are present in external storage, they will be provisioned to this new folder. All new resources created in this folder will be stored and versioned in external storage.'
        ),
        subtitle: t(
          'provisioning.mode-options.folder.subtitle',
          'Use this option to sync external resources into a new folder without affecting the rest of your instance. You can repeat this process for up to 10 folders.'
        ),
      },
    ];

    return filterModeOptions(modeOptions, repoName, settings);
  }, [repoName, settings]);
}
