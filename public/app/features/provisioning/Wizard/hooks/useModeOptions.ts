import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';

import { ModeOption } from '../types';

/**
 * Filters available mode options based on system state and allowed targets
 */
function filterModeOptions(modeOptions: ModeOption[], repoName: string, settings?: RepositoryViewList): ModeOption[] {
  const folderConnected = settings?.items?.some((item) => item.target === 'folder' && item.name !== repoName);
  const allowedTargets = settings?.allowedTargets || ['instance', 'folder'];
  const legacyStorageEnabled = settings?.legacyStorage;

  return modeOptions.map((option) => {
    if (option.disabled) {
      return option;
    }

    const disabledReason = resolveDisabledReason(option, { allowedTargets, folderConnected, legacyStorageEnabled });

    if (!disabledReason) {
      return option;
    }

    return {
      ...option,
      disabled: true,
      disabledReason,
    };
  });
}

type DisableContext = {
  allowedTargets: string[];
  folderConnected?: boolean;
  legacyStorageEnabled?: boolean;
};

// Returns a translated reason why the given mode option should be disabled.
function resolveDisabledReason(option: ModeOption, context: DisableContext) {
  if (!context.allowedTargets.includes(option.target)) {
    return t(
      'provisioning.mode-options.disabled.not-allowed',
      'Provisioning settings for this repository restrict syncing to specific targets. Update the repository configuration to enable this option.'
    );
  }

  if (context.legacyStorageEnabled && option.target !== 'instance') {
    return t(
      'provisioning.mode-options.disabled.legacy-storage',
      'Legacy storage mode only supports syncing the entire Grafana instance.'
    );
  }

  if (option.target === 'instance' && context.folderConnected) {
    return t(
      'provisioning.mode-options.disabled.folder-connected',
      'Full instance synchronization is disabled because another folder is already synced with a repository.'
    );
  }

  if (option.target !== 'instance' && option.target !== 'folder') {
    return t('provisioning.mode-options.disabled.not-supported', 'This option is not supported yet.');
  }

  return undefined;
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
        disabled: false,
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
          'Use this option to sync external resources into a new folder without affecting the rest of your instance.'
        ),
        disabled: false,
      },
    ];

    const options = filterModeOptions(modeOptions, repoName, settings);
    // Filtering 2 mode options on each render; trivial cost, so no need for useMemo here.
    const enabledOptions = options.filter((option) => !option.disabled);
    const disabledOptions = options.filter((option) => option.disabled);

    return {
      enabledOptions,
      disabledOptions,
    };
  }, [repoName, settings]);
}
