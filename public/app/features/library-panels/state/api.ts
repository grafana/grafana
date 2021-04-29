import { LibraryPanelDTO, LibraryPanelSearchResult, PanelModelWithLibraryPanel } from '../types';
import { DashboardSearchHit } from '../../search/types';
import { getBackendSrv } from '../../../core/services/backend_srv';

export interface GetLibraryPanelsOptions {
  searchString?: string;
  perPage?: number;
  page?: number;
  excludeUid?: string;
  sortDirection?: string;
  panelFilter?: string[];
}

export async function getLibraryPanels({
  searchString = '',
  perPage = 100,
  page = 1,
  excludeUid = '',
  sortDirection = '',
  panelFilter = [],
}: GetLibraryPanelsOptions = {}): Promise<LibraryPanelSearchResult> {
  const params = new URLSearchParams();
  params.append('searchString', searchString);
  params.append('sortDirection', sortDirection);
  params.append('panelFilter', panelFilter.join(','));
  params.append('excludeUid', excludeUid);
  params.append('perPage', perPage.toString(10));
  params.append('page', page.toString(10));

  const { result } = await getBackendSrv().get(`/api/library-panels?${params.toString()}`);
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

export async function getConnectedDashboards(uid: string): Promise<DashboardSearchHit[]> {
  const dashboardIds = await getLibraryPanelConnectedDashboards(uid);
  if (dashboardIds.length === 0) {
    return [];
  }

  const searchHits = await getBackendSrv().search({ dashboardIds });
  return searchHits;
}
