import { getBackendSrv } from 'app/core/services/backend_srv';

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

export async function getLibraryPanels(): Promise<LibraryPanelDTO[]> {
  const { result } = await getBackendSrv().get(`/api/library-panels`);
  return result;
}

export async function addLibraryPanel(panelSaveModel: any, folderId: number): Promise<LibraryPanelDTO> {
  const { result } = await getBackendSrv().post(`/api/library-panels`, {
    folderId,
    name: panelSaveModel.title,
    model: panelSaveModel,
  });
  return result;
}

export async function updateLibraryPanel(panelSaveModel: any, folderId: number): Promise<LibraryPanelDTO> {
  const { result } = await getBackendSrv().patch(`/api/library-panels/${panelSaveModel.libraryPanel.uid}`, {
    folderId,
    name: panelSaveModel.title,
    model: panelSaveModel,
  });
  return result;
}

export function deleteLibraryPanel(uid: string): Promise<{ message: string }> {
  return getBackendSrv().delete(`/api/library-panels/${uid}`);
}

export async function getLibraryPanelConnectedDashboards(libraryPanelUid: string): Promise<number[]> {
  const { result } = await getBackendSrv().get(`/api/library-panels/${libraryPanelUid}/dashboards`);
  return result;
}
