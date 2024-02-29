export type ExploreWorkspace = {
  uid: string;
  name: string;
  description: string;
  activeSnapshotUid: string;
  orgId: number;
};

export type ExploreWorkspaceSnapshot = {};

export type GetExploreWorkspacesResponse = {
  exploreWorkspaceSnapshot: ExploreWorkspace;
};
