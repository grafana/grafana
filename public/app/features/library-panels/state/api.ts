import { getBackendSrv } from '@grafana/runtime';
import { LibraryPanelDTO, PanelModelWithLibraryPanel } from '../types';

export async function getLibraryPanels(): Promise<LibraryPanelDTO[]> {
  const { result } = await getBackendSrv().get(`/api/library-panels`);
  return result;
}

export async function getLibraryPanel(uid: string): Promise<LibraryPanelDTO> {
  const { result } = await getBackendSrv().get(`/api/library-panels/${uid}`);
  return result;
}

export async function addLibraryPanel(
  panelSaveModel: PanelModelWithLibraryPanel,
  folderId: number
): Promise<LibraryPanelDTO> {
  const { result } = await getBackendSrv().post(`/api/library-panels`, {
    folderId,
    name: panelSaveModel.title,
    model: panelSaveModel,
  });
  return result;
}

export async function updateLibraryPanel(
  panelSaveModel: PanelModelWithLibraryPanel,
  folderId: number
): Promise<LibraryPanelDTO> {
  const { result } = await getBackendSrv().patch(`/api/library-panels/${panelSaveModel.libraryPanel.uid}`, {
    folderId,
    name: panelSaveModel.title,
    model: panelSaveModel,
    version: panelSaveModel.libraryPanel.version,
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
