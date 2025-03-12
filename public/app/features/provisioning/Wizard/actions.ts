import { GetRepositoryFilesResponse, GetResourceStatsResponse, RepositoryViewList } from '../api';

export type Target = 'instance' | 'folder';

export interface ModeOption {
  target: Target;
  operation: 'pull' | 'migrate';
  label: string;
  description: string;
  disabledReason?: string;
}

export interface SystemState {
  loading: boolean;
  resourceCount: number;
  fileCount: number;
  actions: ModeOption[];
  disabled: ModeOption[];
  folderConnected?: boolean;
}

// possible values
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
  loading: boolean,
  repoName: string,
  settings?: RepositoryViewList,
  files?: GetRepositoryFilesResponse,
  stats?: GetResourceStatsResponse
): SystemState {
  const state: SystemState = {
    loading,
    resourceCount: 0,
    fileCount: files?.items?.length ?? 0,
    actions: [],
    disabled: [],
  };
  if (settings?.items) {
    settings.items.forEach((v) => {
      if (v.name === repoName) {
        return; // do not count yourself
      }
      if (v.target === 'folder') {
        state.folderConnected = true;
      }
      if (v.target === 'instance') {
        state.folderConnected = true;
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
