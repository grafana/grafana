import { wellFormedTree } from './folders';

const [_, { folderA_dashbdD, dashbdD }] = wellFormedTree();

const initialStarredDashboards = [dashbdD.item.uid, folderA_dashbdD.item.uid];

/** Every star set the mock server holds, by `${group}/${kind}`. The stars endpoints read from it. */
export const mockStarSets = new Map<string, Set<string>>();

/** The star set of a kind. The Stars API accepts any group/kind, so a kind that has no set yet starts one. */
export const getMockStarSet = (group: string, kind: string) => {
  const key = `${group}/${kind}`;
  let names = mockStarSets.get(key);
  if (!names) {
    names = new Set();
    mockStarSets.set(key, names);
  }
  return names;
};

/** Seed the starred objects of a kind for a test (replaces that kind's set). The stars endpoints read from it. */
export const setMockStarred = (group: string, kind: string, names: string[]) => {
  mockStarSets.set(`${group}/${kind}`, new Set(names));
};

/** Seed the starred dashboards for a test (replaces the current set). */
export const setMockStarredDashboards = (uids: string[]) => setMockStarred('dashboard.grafana.app', 'Dashboard', uids);

/** Seed the starred folders for a test (replaces the current set). */
export const setMockStarredFolders = (uids: string[]) => setMockStarred('folder.grafana.app', 'Folder', uids);

/** The stars a test starts from: two dashboards, and no object of any other kind. */
export const setupMockStars = () => {
  mockStarSets.clear();
  setMockStarredDashboards(initialStarredDashboards);
};

// A mock server that never resets its fixtures, such as the browser worker, starts from the same stars
setupMockStars();
