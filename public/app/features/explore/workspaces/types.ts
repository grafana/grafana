export type ExploreWorkspace = {
  uid: string;
  name: string;
  description: string;
  activeSnapshotUid: string;
  orgId: number;
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
};

export type CreateExploreWorkspaceResponse = {
  uid: string;
};
