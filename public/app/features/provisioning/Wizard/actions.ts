import {
  GetRepositoryFilesApiResponse,
  GetResourceStatsApiResponse,
  RepositoryViewList,
} from 'app/api/clients/provisioning';

import { ModeOption, SystemState } from './types';

const migrateInstance: ModeOption = {
  target: 'instance',
  operation: 'migrate',
  label: 'Migrate instance to repository',
  description: 'Save all Grafana resources to repository',
};

const pullInstance: ModeOption = {
  target: 'instance',
  operation: 'pull',
  label: 'Pull from repository to instance',
  description: 'Pull resources from repository into this Grafana instance',
};

const pullFolder: ModeOption = {
  target: 'folder',
  operation: 'pull',
  label: 'Pull from repository to folder',
  description: 'Pull repository resources into a specific folder',
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
    resourceCountString: counts.join(','),
    fileCount,
    actions: [],
    disabled: [],
    folderConnected,
  };

  // Legacy storage can only migrate
  if (settings?.legacyStorage) {
    const disabledReason = 'Instance must be migrated first';
    state.actions = [migrateInstance];
    state.disabled = [
      { ...pullInstance, disabledReason },
      { ...pullFolder, disabledReason },
    ];
    return state;
  }

  const actionsToEvaluate = resourceCount
    ? [pullFolder, pullInstance, migrateInstance] // recommend pull when resources already exist
    : [migrateInstance, pullInstance, pullFolder];
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
