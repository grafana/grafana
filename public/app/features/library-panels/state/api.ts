import { lastValueFrom } from 'rxjs';

import { defaultDashboard } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state';

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
  folderFilterUIDs?: string[];
}

export async function getLibraryPanels({
  searchString = '',
  perPage = 100,
  page = 1,
  excludeUid = '',
  sortDirection = '',
  typeFilter = [],
  folderFilterUIDs = [],
}: GetLibraryPanelsOptions = {}): Promise<LibraryElementsSearchResult> {
  const params = new URLSearchParams();
  params.append('searchString', searchString);
  params.append('sortDirection', sortDirection);
  params.append('typeFilter', typeFilter.join(','));
  params.append('folderFilterUIDs', folderFilterUIDs.join(','));
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
  // kinda heavy weight migration process!!!
  const { result } = response.data;
  const dash = new DashboardModel({
    ...defaultDashboard,
    schemaVersion: 35, // should be saved in the library panel
    panels: [result.model],
  });
  const model = dash.panels[0].getSaveModel(); // migrated panel
  dash.destroy(); // kill event listeners
  return {
    ...result,
    model,
  };
}

export async function getLibraryPanelByName(name: string): Promise<LibraryElementDTO[]> {
  const { result } = await getBackendSrv().get<{ result: LibraryElementDTO[] }>(`/api/library-elements/name/${name}`);
  return result;
}

export async function addLibraryPanel(
  panelSaveModel: PanelModelWithLibraryPanel,
  folderUid: string
): Promise<LibraryElementDTO> {
  const { result } = await getBackendSrv().post(`/api/library-elements`, {
    folderUid,
    name: panelSaveModel.libraryPanel.name,
    model: panelSaveModel,
    kind: LibraryElementKind.Panel,
  });
  return result;
}

export async function updateLibraryPanel(panelSaveModel: PanelModelWithLibraryPanel): Promise<LibraryElementDTO> {
  const { libraryPanel, ...model } = panelSaveModel;
  const { uid, name, version, folderUid } = libraryPanel;
  const kind = LibraryElementKind.Panel;
  const { result } = await getBackendSrv().patch(`/api/library-elements/${uid}`, {
    folderUid,
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
