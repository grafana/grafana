import { DataFrame, dataFrameFromJSON, DataFrameJSON, getDisplayProcessor } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { DashboardDTO } from 'app/types';

import { UploadReponse } from './types';

// Likely should be built into the search interface!
export interface GrafanaStorage {
  get: <T = any>(path: string) => Promise<T>;
  list: (path: string) => Promise<DataFrame | undefined>;
  upload: (folder: string, file: File, overwriteExistingFile: boolean) => Promise<UploadReponse>;
  createFolder: (path: string) => Promise<{ error?: string }>;
  delete: (path: { isFolder: boolean; path: string }) => Promise<{ error?: string }>;

  /**
   * Temporary shim that will return a DashboardDTO shape for files in storage
   * Longer term, this will call an "Entity API" that is eventually backed by storage
   */
  getDashboard: (path: string) => Promise<DashboardDTO>;
  saveDashboard: (options: SaveDashboardCommand) => Promise<any>;
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

  // Temporary shim that can be loaded into the existing dashboard page structure
  async getDashboard(path: string): Promise<DashboardDTO> {
    if (!config.featureToggles.dashboardsFromStorage) {
      return Promise.reject('Dashboards from storage is not enabled');
    }

    if (!path.endsWith('.json')) {
      path += '.json';
    }

    const result = await backendSrv.get(`/api/storage/read/${path}`);
    result.uid = path;
    delete result.id; // Saved with the dev dashboards!

    return {
      meta: {
        uid: path,
        slug: path,
        canEdit: true,
        canSave: true,
        canStar: false, // needs id
      },
      dashboard: result,
    };
  }

  async saveDashboard(options: SaveDashboardCommand): Promise<any> {
    if (!config.featureToggles.dashboardsFromStorage) {
      return Promise.reject('Dashboards from storage is not enabled');
    }

    const blob = new Blob([JSON.stringify(options.dashboard)], {
      type: 'application/json',
    });

    const uid = options.dashboard.uid;
    const formData = new FormData();
    if (options.message) {
      formData.append('message', options.message);
    }
    formData.append('overwriteExistingFile', options.overwrite === false ? 'false' : 'true');
    formData.append('file.path', uid);
    formData.append('file', blob);
    const res = await fetch('/api/storage/upload', {
      method: 'POST',
      body: formData,
    });

    let body = (await res.json()) as UploadReponse;
    if (res.status !== 200 && !body?.err) {
      console.log('SAVE', options, body);
      return Promise.reject({ message: body?.message ?? res.statusText });
    }

    return {
      uid,
      url: `/g/${uid}`,
      slug: uid,
      status: 'success',
    };
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
