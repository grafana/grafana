import { getBackendSrv } from '@grafana/runtime';
import { FolderDTO, FolderInfo } from 'app/types';

export interface FolderRequestOptions {
  withAccessControl?: boolean;
}

export interface Folder {
  uid: string;
  title: string;
  description?: string;
}

export interface CreateFolderPayload {
  title: string;
  description?: string;
}

export interface DeleteMessage {
  message: string;
}

export interface FolderService {
  /** Create a new folder */
  createFolder(payload: CreateFolderPayload): Promise<Folder>;

  /** Get simple folder information */
  getFolderByUid(uid: string): Promise<Folder>;

  /** Get simple folder and potentially attached access control */
  getFolderDTOByUid(uid: string, opts?: FolderRequestOptions): Promise<FolderDTO>;

  /** Delete a folder */
  deleteFolder(uid: string, showSuccessAlert?: boolean): Promise<DeleteMessage>;
}

class LegacyFolderService implements FolderService {
  async getFolderByUid(uid: string): Promise<Folder> {
    return getBackendSrv().get(`/api/folders/${uid}`);
  }

  async getFolderDTOByUid(uid: string, opts?: FolderRequestOptions): Promise<FolderDTO> {
    const queryParams = new URLSearchParams();
    if (opts?.withAccessControl) {
      queryParams.set('accesscontrol', 'true');
    }

    return getBackendSrv().get<FolderDTO>(`/api/folders/${uid}?${queryParams.toString()}`, undefined, undefined, {
      showErrorAlert: false,
    });
  }

  async createFolder(payload: CreateFolderPayload): Promise<Folder> {
    return getBackendSrv().post<Folder>('/api/folders', payload);
  }

  async deleteFolder(uid: string, showSuccessAlert?: boolean | undefined): Promise<DeleteMessage> {
    // return response.JSON(http.StatusOK, util.DynMap{
    //     "message": "Folder deleted",
    // })
    return getBackendSrv().delete<DeleteMessage>(`/api/folders/${uid}?forceDeleteRules=false`, undefined, {
      showSuccessAlert,
    });
  }
}

export function moveFolder(uid: string, toFolder: FolderInfo) {
  const payload = {
    parentUid: toFolder.uid,
  };
  return getBackendSrv().post(`/api/folders/${uid}/move`, payload, { showErrorAlert: false });
}

let service = new LegacyFolderService();

export function getFolderService(): FolderService {
  return service;
}
