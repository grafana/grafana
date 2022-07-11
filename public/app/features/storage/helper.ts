import { DataFrame, dataFrameFromJSON, DataFrameJSON, getDisplayProcessor } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';

import { UploadReponse } from './types';

// Likely should be built into the search interface!
export interface GrafanaStorage {
  get: <T = any>(path: string) => Promise<T>;
  list: (path: string) => Promise<DataFrame | undefined>;
  upload: (folder: string, file: File) => Promise<UploadReponse>;
  createFolder: (path: string) => Promise<{ error?: string }>;
  delete: (path: { isFolder: boolean; path: string }) => Promise<{ error?: string }>;
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

  async upload(folder: string, file: File): Promise<UploadReponse> {
    const formData = new FormData();
    formData.append('folder', folder);
    formData.append('file', file);
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
}

let storage: GrafanaStorage | undefined;

export function getGrafanaStorage() {
  if (!storage) {
    storage = new SimpleStorage();
  }
  return storage;
}
