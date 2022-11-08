import { DataFrame, dataFrameFromJSON, DataFrameJSON, getDisplayProcessor } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import {
  UploadReponse,
  StorageInfo,
  ItemOptions,
  WriteValueRequest,
  WriteValueResponse,
  ObjectInfo,
  ObjectHistory,
} from './types';

export interface ObjectParams {
  summary?: boolean; // defaults false
  body?: boolean; // default true
}

// Likely should be built into the search interface!
export interface GrafanaStorage {
  get: <T = unknown>(path: string, params?: ObjectParams) => Promise<ObjectInfo<T>>;
  list: (path: string) => Promise<DataFrame | undefined>;
  history: (path: string) => Promise<ObjectHistory>;

  upload: (folder: string, file: File, overwriteExistingFile: boolean) => Promise<UploadReponse>;
  createFolder: (path: string) => Promise<{ error?: string }>;
  delete: (path: { isFolder: boolean; path: string }) => Promise<{ error?: string }>;

  /** Admin only */
  getConfig: () => Promise<StorageInfo[]>;

  /** Called before save */
  getOptions: (path: string) => Promise<ItemOptions>;

  /**
   * Temporary shim that will return a DashboardDTO shape for files in storage
   * Longer term, this will call an "Entity API" that is eventually backed by storage
   */
  getDashboard: (path: string) => Promise<DashboardDTO>;

  /** Saves dashbaords */
  write: (path: string, options: WriteValueRequest) => Promise<WriteValueResponse>;
}

class SimpleStorage implements GrafanaStorage {
  constructor() {}

  async get<T = any>(path: string, params?: ObjectParams): Promise<ObjectInfo<T>> {
    const storagePath = `api/object/store/${path}`.replace('//', '/');
    return getBackendSrv().get<ObjectInfo<T>>(storagePath, params);
  }

  async history(path: string): Promise<ObjectHistory> {
    const storagePath = `api/object/history/${path}`.replace('//', '/');
    return getBackendSrv().get<ObjectHistory>(storagePath);
  }

  async list(path: string): Promise<DataFrame | undefined> {
    let url = 'api/object/list/';
    if (path) {
      url += path;
    }
    if (!url.endsWith('/')) {
      url += '/';
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
      '/api/object/createFolder',
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
    const res = await getBackendSrv().delete<{ success: boolean; message: string }>(`/api/object/store/${req.path}`);

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
    let scope = folder;
    let idx = folder.indexOf('/');
    if (idx > 0) {
      scope = folder.substring(0, idx);
      folder = folder.substring(idx + 1);
    } else {
      folder = ''; // root folder
    }

    const formData = new FormData();
    formData.append('folder', folder);
    formData.append('file', file);
    formData.append('overwriteExistingFile', String(overwriteExistingFile));
    const res = await fetch('/api/object/upload/' + scope, {
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

  // Temporary shim that can be loaded into the existing dashboard page structure
  async getDashboard(path: string): Promise<DashboardDTO> {
    if (!config.featureToggles.dashboardsFromStorage) {
      return Promise.reject('Dashboards from storage is not enabled');
    }

    if (!path.endsWith('.json')) {
      path += '.json';
    }

    if (!path.startsWith('drive/')) {
      path = `drive/${path}`;
    }

    const result = await this.get<DashboardDataDTO>(path);

    if (!result.object?.body) {
      throw 'not found: ' + path;
    }

    result.object.body.uid = path;

    return {
      meta: {
        uid: path,
        slug: path,
        canEdit: true,
        canSave: true,
        canStar: false, // needs id
        // updated: result.object.updated,
        updatedBy: result.object.updatedBy,
      },
      dashboard: result.object.body,
    };
  }

  async write(path: string, options: WriteValueRequest): Promise<WriteValueResponse> {
    return backendSrv.post<WriteValueResponse>(`/api/object/store/${path}`, options);
  }

  async getConfig() {
    return getBackendSrv().get<StorageInfo[]>('/api/storage/config');
  }

  async getOptions(path: string) {
    return getBackendSrv().get<ItemOptions>(`/api/object/options/${path}`);
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
