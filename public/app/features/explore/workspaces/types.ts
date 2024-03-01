export type ExploreWorkspace = {
  uid: string;
  name: string;
  description: string;
  activeSnapshotUid: string;
  orgId: number;
  userId: number;

  user: { login: string; name: string };
  activeSnapshot?: ExploreWorkspaceSnapshot;
};

export type ExploreWorkspaceSnapshot = {};

// get workspaces

export type GetExploreWorkspacesCommand = {};

export type GetExploreWorkspacesResponse = {
  exploreWorkspaces: ExploreWorkspace[];
};

// get a workspace

export type GetExploreWorkspaceCommand = {
  exploreWorkspaceUID: string;
};

export type GetExploreWorkspaceResponse = {
  exploreWorkspace: ExploreWorkspace;
};

// create a workspace

export type CreateExploreWorkspaceCommand = {
  name: string;
  description: string;
  config: Object;
};

export type CreateExploreWorkspaceResponse = {
  uid: string;
};

// update latest

export type UpdateExploreWorkspaceLatestSnapshotCommand = {
  exploreWorkspaceUID: string;
  config: string;
};

export type UpdateExploreWorkspaceLatestSnapshotResponse = {
  snapshot: ExploreWorkspaceSnapshot;
};
