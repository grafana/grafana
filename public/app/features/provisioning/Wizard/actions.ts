import {
  GetRepositoryFilesApiResponse,
  GetResourceStatsApiResponse,
  RepositoryViewList,
} from 'app/api/clients/provisioning';

import { ModeOption, SystemState } from './types';

const migrateInstance: ModeOption = {
  target: 'instance',
  operation: 'migrate',
  label: 'Sync all resources with external storage',
  description:
    'Resources will be synced with external storage and provisioned into this instance. Existing Grafana resources will be migrated and merged if needed. After setup, all new resources and changes will be saved to external storage and automatically provisioned back into the instance.',
  subtitle: 'Use this option if you want to sync and manage your entire Grafana instance through external storage.',
};

const pullFolder: ModeOption = {
  target: 'folder',
  operation: 'pull',
  label: 'Sync external storage to a new Grafana folder',
  description:
    'After setup, a new Grafana folder will be created and synced with external storage. If any resources are present in external storage, they will be provisioned to this new folder. All new resources created in this folder will be stored and versioned in external storage.',
  subtitle:
    'Use this option to sync external resources into a new folder without affecting the rest of your instance. You can repeat this process for up to 10 folders.',
};

function getDisabledReason(action: ModeOption, resourceCount: number, folderConnected?: boolean) {
  // Disable pull instance if there are existing dashboards or folders
  if (action.target === 'instance' && action.operation === 'pull' && resourceCount > 0) {
    return 'Cannot pull to instance when you have existing resources. Please migrate your existing resources first.';
  }

  if (!folderConnected) {
    return undefined;
  }

  if (action.operation === 'migrate') {
    return 'Cannot migrate when a folder is already mounted.';
  }

  if (action.target === 'instance') {
    return 'Instance-wide connection is disabled because folders are connected to repositories.';
  }

  return undefined;
}

export function getState(
  repoName: string,
  settings?: RepositoryViewList,
  files?: GetRepositoryFilesApiResponse,
  stats?: GetResourceStatsApiResponse
): SystemState {
  const folderConnected = settings?.items?.some((item) => item.target === 'folder' && item.name !== repoName);

  const fileCount =
    files?.items?.reduce((count, file) => {
      const path = file.path ?? '';
      return path.endsWith('.json') || path.endsWith('.yaml') ? count + 1 : count;
    }, 0) ?? 0;

  let counts: string[] = [];
  let resourceCount = 0;
  stats?.instance?.forEach((stat) => {
    switch (stat.group) {
      case 'folders': // fallthrough
      case 'folder.grafana.app':
        resourceCount += stat.count;
        counts.push(`${stat.count} ${stat.count > 1 ? 'folders' : 'folder'}`);
        break;
      case 'dashboard.grafana.app':
        resourceCount += stat.count;
        counts.push(`${stat.count} ${stat.count > 1 ? 'dashboards' : 'dashboard'}`);
        break;
    }
  });

  const state: SystemState = {
    resourceCount,
    resourceCountString: counts.join(',\n'),
    fileCount,
    actions: [],
    disabled: [],
    folderConnected,
  };

  // Legacy storage can only migrate
  if (settings?.legacyStorage) {
    const disabledReason = 'Instance must be migrated first';
    state.actions = [migrateInstance];
    state.disabled = [{ ...pullFolder, disabledReason }];
    return state;
  }

  const actionsToEvaluate = [migrateInstance, pullFolder];
  actionsToEvaluate.forEach((action) => {
    const reason = getDisabledReason(action, resourceCount, folderConnected);
    if (reason) {
      state.disabled.push({ ...action, disabledReason: reason });
    } else {
      state.actions.push(action);
    }
  });

  return state;
}
