import { getBackendSrv } from './backend_srv';

export interface LibraryPanelDTO {
  id: number;
  orgId: number;
  folderId: number;
  uid: string;
  name: string;
  model: any;
  meta: LibraryPanelDTOMeta;
}

export interface LibraryPanelDTOMeta {
  canEdit: boolean;
  connectedDashboards: number;
  created: string;
  updated: string;
  createdBy: LibraryPanelDTOMetaUser;
  updatedBy: LibraryPanelDTOMetaUser;
}

export interface LibraryPanelDTOMetaUser {
  id: number;
  name: string;
  avatarUrl: string;
}

export class LibrarySrv {
  async getLibraryPanels(): Promise<LibraryPanelDTO[]> {
    const { result } = await getBackendSrv().get(`/api/library-panels`);
    return result;
  }

  async getLibraryPanelConnectedDashboards(libraryPanelUid: string): Promise<number[]> {
    const { result } = await getBackendSrv().get(`/api/library-panels/${libraryPanelUid}/dashboards`);
    return result;
  }

  async addLibraryPanel(panelSaveModel: any, folderId: number): Promise<LibraryPanelDTO> {
    const { result } = await getBackendSrv().post(`/api/library-panels`, {
      folderId,
      name: panelSaveModel.title,
      model: panelSaveModel,
    });
    return result;
  }

  async updateLibraryPanel(panelSaveModel: any, folderId: number): Promise<LibraryPanelDTO> {
    const { result } = await getBackendSrv().patch(`/api/library-panels/${panelSaveModel.libraryPanel.uid}`, {
      folderId,
      name: panelSaveModel.title,
      model: panelSaveModel,
    });
    return result;
  }

  deleteLibraryPanel(uid: string): Promise<{ message: string }> {
    return getBackendSrv().delete(`/api/library-panels/${uid}`);
  }

  disconnectLibraryPanel(uid: string, dashboardId: number) {
    return getBackendSrv().delete(`/api/library-panels/${uid}/dashboards/${dashboardId}`);
  }
}

export const librarySrv = new LibrarySrv();
export const getLibrarySrv = (): LibrarySrv => librarySrv;
