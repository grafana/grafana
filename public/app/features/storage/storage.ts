import { DataFrame, dataFrameFromJSON, DataFrameJSON, getDisplayProcessor } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { UploadReponse, StorageInfo, ItemOptions, WriteValueRequest, WriteValueResponse } from './types';

// Likely should be built into the search interface!
export interface GrafanaStorage {
  get: <T = any>(path: string) => Promise<T>;
  list: (path: string) => Promise<DataFrame | undefined>;
  upload: (folder: string, file: File, overwriteExistingFile: boolean) => Promise<UploadReponse>;
  createFolder: (path: string) => Promise<{ error?: string }>;
  delete: (path: { isFolder: boolean; path: string }) => Promise<{ error?: string }>;

  /** Admin only */
  getConfig: () => Promise<StorageInfo[]>;

  /** Called before save */
  getOptions: (path: string) => Promise<ItemOptions>;

  /** Saves dashbaords */
  write: (path: string, options: WriteValueRequest) => Promise<WriteValueResponse>;
}

class SimpleStorage implements GrafanaStorage {
  constructor() {}

  async get<T = any>(path: string): Promise<T> {
    const storagePath = `api/storage/read/${path}`.replace('//', '/');
    return getBackendSrv().get<T>(storagePath);
  }

  async list(path: string): Promise<DataFrame | undefined> {
    let url = 'api/storage/list/';
    if (path) {
      url += path + '/';
    }
    const rsp = await getBackendSrv().get<DataFrameJSON>(url);
    if (rsp?.data) {
      const f = dataFrameFromJSON(rsp);
      for (const field of f.fields) {
        field.display = getDisplayProcessor({ field, theme: config.theme2 });
      }
      return f;
    }
    return undefined;
  }

  async createFolder(path: string): Promise<{ error?: string }> {
    const res = await getBackendSrv().post<{ success: boolean; message: string }>(
      '/api/storage/createFolder',
      JSON.stringify({ path })
    );

    if (!res.success) {
      return {
        error: res.message ?? 'unknown error',
      };
    }

    return {};
  }

  async deleteFolder(req: { path: string; force: boolean }): Promise<{ error?: string }> {
    const res = await getBackendSrv().post<{ success: boolean; message: string }>(
      `/api/storage/deleteFolder`,
      JSON.stringify(req)
    );

    if (!res.success) {
      return {
        error: res.message ?? 'unknown error',
      };
    }

    return {};
  }

  async deleteFile(req: { path: string }): Promise<{ error?: string }> {
    const res = await getBackendSrv().post<{ success: boolean; message: string }>(`/api/storage/delete/${req.path}`);

    if (!res.success) {
      return {
        error: res.message ?? 'unknown error',
      };
    }

    return {};
  }

  async delete(req: { isFolder: boolean; path: string }): Promise<{ error?: string }> {
    return req.isFolder ? this.deleteFolder({ path: req.path, force: true }) : this.deleteFile({ path: req.path });
  }

  async upload(folder: string, file: File, overwriteExistingFile: boolean): Promise<UploadReponse> {
    const formData = new FormData();
    formData.append('folder', folder);
    formData.append('file', file);
    formData.append('overwriteExistingFile', String(overwriteExistingFile));
    const res = await fetch('/api/storage/upload', {
      method: 'POST',
      body: formData,
    });

    let body = (await res.json()) as UploadReponse;
    if (!body) {
      body = {} as any;
    }
    body.status = res.status;
    body.statusText = res.statusText;
    if (res.status !== 200 && !body.err) {
      body.err = true;
    }
    return body;
  }

  async write(path: string, options: WriteValueRequest): Promise<WriteValueResponse> {
    return backendSrv.post<WriteValueResponse>(`/api/storage/write/${path}`, options);
  }

  async getConfig() {
    return getBackendSrv().get<StorageInfo[]>('/api/storage/config');
  }

  async getOptions(path: string) {
    return getBackendSrv().get<ItemOptions>(`/api/storage/options/${path}`);
  }
}

export function filenameAlreadyExists(folderName: string, fileNames: string[]) {
  const lowerCase = folderName.toLowerCase();
  const trimmedLowerCase = lowerCase.trim();
  const existingTrimmedLowerCaseNames = fileNames.map((f) => f.trim().toLowerCase());

  return existingTrimmedLowerCaseNames.includes(trimmedLowerCase);
}

let storage: GrafanaStorage | undefined;

export function getGrafanaStorage() {
  if (!storage) {
    storage = new SimpleStorage();
  }
  return storage;
}
