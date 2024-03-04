export type ExploreWorkspace = {
  uid: string;
  name: string;
  description: string;
  activeSnapshotUid: string;
  orgId: number;
  userId: number;

  user: { Login: string; Name: string };
  activeSnapshot: ExploreWorkspaceSnapshot;
};

export type ExploreWorkspaceSnapshot = {
  uid: string;
  name: string;
  description: string;
  userId: string;
  updated: string;
  created: string;
  config: string;
  version: number;

  user: { Login: string; Name: string };
};

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

// snapshots

export type CreateExploreWorkspaceSnapshotCommand = {
  name: string;
  description: string;
  exploreWorkspaceUID: string;
  config?: string;
};

export type CreateExploreWorkspaceSnapshotResponse = {
  createdSnapshot: ExploreWorkspaceSnapshot;
};

// get single snapshot

export type GetExploreWorkspaceSnapshotCommand = {
  uid: string;
};

export type GetExploreWorkspaceSnapshotResponse = {
  snapshot: ExploreWorkspaceSnapshot;
};

// get all snapshots

export type GetExploreWorkspaceSnapshotsCommand = {
  exploreWorkspaceUid: string;
};

export type GetExploreWorkspaceSnapshotsResponse = {
  snapshots: ExploreWorkspaceSnapshot[];
};
