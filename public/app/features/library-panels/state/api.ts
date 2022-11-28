import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '../../../core/services/backend_srv';
import { DashboardSearchItem } from '../../search/types';
import {
  LibraryElementConnectionDTO,
  LibraryElementDTO,
  LibraryElementKind,
  LibraryElementsSearchResult,
  PanelModelWithLibraryPanel,
} from '../types';

export interface GetLibraryPanelsOptions {
  searchString?: string;
  perPage?: number;
  page?: number;
  excludeUid?: string;
  sortDirection?: string;
  typeFilter?: string[];
  folderFilter?: string[];
}

export async function getLibraryPanels({
  searchString = '',
  perPage = 100,
  page = 1,
  excludeUid = '',
  sortDirection = '',
  typeFilter = [],
  folderFilter = [],
}: GetLibraryPanelsOptions = {}): Promise<LibraryElementsSearchResult> {
  const params = new URLSearchParams();
  params.append('searchString', searchString);
  params.append('sortDirection', sortDirection);
  params.append('typeFilter', typeFilter.join(','));
  params.append('folderFilter', folderFilter.join(','));
  params.append('excludeUid', excludeUid);
  params.append('perPage', perPage.toString(10));
  params.append('page', page.toString(10));
  params.append('kind', LibraryElementKind.Panel.toString(10));

  const { result } = await getBackendSrv().get<{ result: LibraryElementsSearchResult }>(
    `/api/library-elements?${params.toString()}`
  );
  return result;
}

export async function getLibraryPanel(uid: string, isHandled = false): Promise<LibraryElementDTO> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<{ result: LibraryElementDTO }>({
      method: 'GET',
      url: `/api/library-elements/${uid}`,
      showSuccessAlert: !isHandled,
      showErrorAlert: !isHandled,
    })
  );
  return response.data.result;
}

export async function getLibraryPanelByName(name: string): Promise<LibraryElementDTO[]> {
  const { result } = await getBackendSrv().get<{ result: LibraryElementDTO[] }>(`/api/library-elements/name/${name}`);
  return result;
}

export async function addLibraryPanel(
  panelSaveModel: PanelModelWithLibraryPanel,
  folderId: number
): Promise<LibraryElementDTO> {
  const { result } = await getBackendSrv().post(`/api/library-elements`, {
    folderId,
    name: panelSaveModel.libraryPanel.name,
    model: panelSaveModel,
    kind: LibraryElementKind.Panel,
  });
  return result;
}

export async function updateLibraryPanel(panelSaveModel: PanelModelWithLibraryPanel): Promise<LibraryElementDTO> {
  const { uid, name, version } = panelSaveModel.libraryPanel;
  const kind = LibraryElementKind.Panel;
  const model = panelSaveModel;
  const { result } = await getBackendSrv().patch(`/api/library-elements/${uid}`, {
    name,
    model,
    version,
    kind,
  });
  return result;
}

export function deleteLibraryPanel(uid: string): Promise<{ message: string }> {
  return getBackendSrv().delete(`/api/library-elements/${uid}`);
}

export async function getLibraryPanelConnectedDashboards(
  libraryPanelUid: string
): Promise<LibraryElementConnectionDTO[]> {
  const { result } = await getBackendSrv().get<{ result: LibraryElementConnectionDTO[] }>(
    `/api/library-elements/${libraryPanelUid}/connections`
  );
  return result;
}

export async function getConnectedDashboards(uid: string): Promise<DashboardSearchItem[]> {
  const connections = await getLibraryPanelConnectedDashboards(uid);
  if (connections.length === 0) {
    return [];
  }

  const searchHits = await getBackendSrv().search({ dashboardUIDs: connections.map((c) => c.connectionUid) });

  return searchHits;
}
