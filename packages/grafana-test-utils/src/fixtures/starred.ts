import { wellFormedTree } from './folders';

const [_, { folderA_dashbdD, dashbdD }] = wellFormedTree();

const initialStarredDashboards = [dashbdD.item.uid, folderA_dashbdD.item.uid];

export const setupMockStarredDashboards = () => {
  mockStarredDashboardsMap.clear();
  initialStarredDashboards.forEach((uid) => {
    mockStarredDashboardsMap.set(uid, true);
  });
};

export const mockStarredDashboardsMap = new Map<string, boolean>();
