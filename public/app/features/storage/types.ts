export enum StorageView {
  Data = 'data',
  Config = 'config',
  Perms = 'perms',
  Export = 'export',
  History = 'history',
  AddRoot = 'add',
}

export interface UploadReponse {
  status: number;
  statusText: string;

  err?: boolean;
  message: string;
  path: string;
}

// editable: true,
// builtin: true,
// ready: true,
// config: {
// type: "disk",
// prefix: "public-static",
// name: "Public static files",
// description: "Access files from the static public files",
// disk: {
// path: "/Users/ryan/workspace/grafana/grafana/public",
// roots: [
// "/testdata/",
// "/img/",
// "/gazetteer/",
// "/maps/"
// ]
// }
// }

export interface StorageInfo {
  editable?: boolean;
  builtin?: boolean;
  ready?: boolean;
  config: StorageConfig;
}

export interface StorageConfig {
  type: string;
  prefix: string;
  name: string;
  description: string;
  disk?: {
    path: string;
  };
  git?: {
    remote: string;
    branch: string;
    root: string;
    requirePullRequest: boolean;
    accessToken: string;
  };
  sql?: {};
}
