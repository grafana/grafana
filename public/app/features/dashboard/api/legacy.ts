import { AppEvents, UrlQueryMap } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { AnnoKeyCreatedBy, AnnoKeyFolder, AnnoKeyFolderId, AnnoKeyFolderTitle, AnnoKeyFolderUrl, AnnoKeyRedirectUri, AnnoKeySlug, AnnoKeyUpdatedBy, AnnoKeyUpdatedTimestamp } from 'app/features/apiserver/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { SaveDashboardResponseDTO, DashboardDTO, DashboardDataDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, DashboardWithAccessInfo } from './types';

export class LegacyDashboardAPI implements DashboardAPI<DashboardDataDTO> {
  constructor() {}

  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    dashboardWatcher.ignoreNextSave();

    return getBackendSrv().post<SaveDashboardResponseDTO>('/api/dashboards/db/', {
      dashboard: options.dashboard,
      message: options.message ?? '',
      overwrite: options.overwrite ?? false,
      folderUid: options.folderUid,
    });
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${uid}`, { showSuccessAlert });
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    const result = await getBackendSrv().get<DashboardDTO>(`/api/dashboards/uid/${uid}`, params);

    if (result.meta.isFolder) {
      appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
      throw new Error('Dashboard not found');
    }
 

    const response: DashboardWithAccessInfo<DashboardDataDTO> = {
      kind: 'DashboardWithAccessInfo',
      apiVersion: 'legacy',
      metadata: {
        creationTimestamp: result.meta.created!,
        name: result.dashboard.uid,
        resourceVersion: String(result.dashboard.version || 0),
        annotations: {
         [AnnoKeyCreatedBy]: result.meta.createdBy,
         [AnnoKeyUpdatedTimestamp]: result.meta.updated,
         [AnnoKeyUpdatedBy]: result.meta.updatedBy,
         [AnnoKeySlug]: result.meta.slug,
         [AnnoKeyFolder]: result.meta.folderUid,
         [AnnoKeyFolderTitle]: result.meta.folderTitle,
         [AnnoKeyFolderUrl]: result.meta.folderUrl,
         [AnnoKeyFolderId]: result.meta.folderId,
         [AnnoKeyRedirectUri]: result.redirectUri,
        },
        // Adding legacy metadata for legacy API backwards compatibility
        _legacyMetadata: result.meta
      },
      spec: result.dashboard,
      access: {
        slug: result.meta.slug,
        url: result.meta.url,
        canAdmin: result.meta.canAdmin,
        canDelete: result.meta.canDelete,
        canEdit: result.meta.canEdit,
        canSave: result.meta.canSave,
        canShare: result.meta.canShare,
        canStar: result.meta.canStar,
        annotationsPermissions: result.meta.annotationsPermissions,
      },
    }

    return response;
  }
}
