export enum StorageView {
  Data = 'data',
  Config = 'config',
  Perms = 'perms',
  Upload = 'upload',
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
