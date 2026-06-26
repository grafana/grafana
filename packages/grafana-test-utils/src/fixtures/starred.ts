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

export const mockStarredFoldersMap = new Map<string, boolean>();
