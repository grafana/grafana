import { wellFormedTree } from './folders';

const [_, { folderA_dashbdD, dashbdD }] = wellFormedTree();

const initialStarredDashboards = [dashbdD.item.uid, folderA_dashbdD.item.uid];

export const setupMockStarredDashboards = () => {
  mockStarredDashboardsMap.clear();
  initialStarredDashboards.forEach((uid) => {
    mockStarredDashboardsMap.set(uid, true);
  });
};

/**
 * Seed the starred dashboards for a test (replaces the current set) — use this instead of mutating
 * `mockStarredDashboardsMap` directly. The stars endpoints read from it.
 */
export const setMockStarredDashboards = (uids: string[]) => {
  mockStarredDashboardsMap.clear();
  uids.forEach((uid) => mockStarredDashboardsMap.set(uid, true));
};

export const mockStarredDashboardsMap = new Map<string, boolean>(initialStarredDashboards.map((uid) => [uid, true]));

// No folders are starred by default
export const setupMockStarredFolders = () => {
  mockStarredFoldersMap.clear();
};

const mockStarredFoldersMap = new Map<string, boolean>();

/** Seed the starred folders for a test (replaces the current set). The stars endpoints read from it. */
export const setMockStarredFolders = (uids: string[]) => {
  mockStarredFoldersMap.clear();
  uids.forEach((uid) => mockStarredFoldersMap.set(uid, true));
};

/**
 * Every star set the mock server holds, by `${group}/${kind}`. Dashboards and folders always have theirs. The
 * Stars API accepts any group/kind, so a star of another kind starts a set of its own.
 */
export const mockStarSets = new Map<string, Map<string, boolean>>([
  ['dashboard.grafana.app/Dashboard', mockStarredDashboardsMap],
  ['folder.grafana.app/Folder', mockStarredFoldersMap],
]);

// No object of an app kind is starred by default
export const setupMockStarredAppKinds = () => {
  for (const [key, names] of mockStarSets) {
    if (names !== mockStarredDashboardsMap && names !== mockStarredFoldersMap) {
      mockStarSets.delete(key);
    }
  }
};

/** Seed the starred objects of an app kind for a test (replaces that kind's set). The stars endpoints read from it. */
export const setMockStarredAppKind = (group: string, kind: string, names: string[]) => {
  mockStarSets.set(`${group}/${kind}`, new Map(names.map((name) => [name, true])));
};
