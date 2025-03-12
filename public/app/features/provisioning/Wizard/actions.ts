import { GetRepositoryFilesResponse, GetResourceStatsResponse, RepositoryViewList } from '../api';

export type Target = 'instance' | 'folder';
export type Operation = 'pull' | 'migrate';

export interface ModeOption {
  target: Target;
  operation: Operation;
  label: string;
  description: string;
  disabledReason?: string;
}

export interface SystemState {
  resourceCount: number;
  fileCount: number;
  actions: ModeOption[];
  disabled: ModeOption[];
  folderConnected?: boolean;
}

const migrateInstance: ModeOption = {
  target: 'instance',
  operation: 'migrate',
  label: 'Migrate Instance to Repository',
  description: 'Save all Grafana resources to repository',
};

const pullInstance: ModeOption = {
  target: 'instance',
  operation: 'pull',
  label: 'Pull from Repository to Instance',
  description: 'Pull resources from repository into this Grafana instance',
};
const pullFolder: ModeOption = {
  target: 'folder',
  operation: 'pull',
  label: 'Pull from Repository to Folder',
  description: 'Pull repository resources into a specific folder',
};

export function getState(
  repoName: string,
  settings?: RepositoryViewList,
  files?: GetRepositoryFilesResponse,
  stats?: GetResourceStatsResponse
): SystemState {
  const state: SystemState = {
    resourceCount: 0,
    fileCount: 0,
    actions: [],
    disabled: [],
  };
  if (settings?.items) {
    state.folderConnected = settings.items.some((item) => item.target === 'folder' && item.name !== repoName);
  }

  if (files?.items) {
    files.items.forEach((v) => {
      const p = v.path ?? '';
      if (p.endsWith('.json') || p.endsWith('.yaml')) {
        state.fileCount++;
      }
    });
  }

  if (stats?.instance) {
    for (const x of stats.instance) {
      state.resourceCount += x.count;
    }
  }

  // Legacy can only migate
  if (settings?.legacyStorage) {
    state.actions = [migrateInstance];
    state.disabled = [
      {
        ...pullInstance,
        disabledReason: 'Instance must be migrated first',
      },
      {
        ...pullFolder,
        disabledReason: 'Instance must be migrated first',
      },
    ];
    return state;
  }

  [migrateInstance, pullInstance, pullFolder].forEach((action) => {
    // Disable pull instance option if there are existing dashboards or folders
    if (action.target === 'instance' && action.operation === 'pull' && state.resourceCount > 0) {
      state.disabled.push({
        ...action,
        disabledReason:
          'Cannot pull to instance when you have existing resources. Please migrate your existing resources first.',
      });
      return;
    }

    if (action.operation === 'migrate' && state.folderConnected) {
      state.disabled.push({
        ...action,
        disabledReason: 'Cannot migrate when a folder is already mounted.',
      });
      return;
    }

    if (action.target === 'instance' && state.folderConnected) {
      state.disabled.push({
        ...action,
        disabledReason: 'Instance-wide connection is disabled because folders are connected to repositories.',
      });
      return;
    }

    state.actions.push(action);
  });

  return state;
}
