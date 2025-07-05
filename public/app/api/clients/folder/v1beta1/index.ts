import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';

import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  // AnnoKeyFolderUrl,
  AnnoKeyManagerKind,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
  ManagerKind,
} from '../../../../features/apiserver/types';
import { useGetFolderQuery as useGetFoldersQueryLegacy } from '../../../../features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/services';
import { refetchChildren } from '../../../../features/browse-dashboards/state';
import { GENERAL_FOLDER_UID } from '../../../../features/search/constants';
import { FolderDTO } from '../../../../types';

import { generatedAPI } from './endpoints.gen';

export const folderAPIv1beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    deleteFolder: {
      onQueryStarted: (args, { queryFulfilled, dispatch }) => {
        // Refetch for anything using the old API.
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: GENERAL_FOLDER_UID,
              pageSize: PAGE_SIZE,
            })
          );
        });
      },
    },
  },
});

export const { useGetFolderQuery, useGetFolderParentsQuery } = folderAPIv1beta1;

function folderUrl(uid: string, slug: string): string {
  // mimics https://github.com/grafana/grafana/blob/79fe8a9902335c7a28af30e467b904a4ccfac503/pkg/services/dashboards/models.go#L188
  return `${config.appSubUrl}/dashboards/f/${uid}/${slug}`;
}

export function useGetFolderQueryFacade(uid?: string) {
  if (config.featureToggles.foldersAppPlatformAPI) {
    const result = useGetFolderQuery(uid ? { name: uid } : skipToken);
    const resultParents = useGetFolderParentsQuery(uid ? { name: uid } : skipToken);

    let newData: FolderDTO | undefined = undefined;
    if (result.data && resultParents.data) {
      newData = {
        canAdmin: false,
        canDelete: false,
        canEdit: false,
        canSave: false,
        created: result.data.metadata.creationTimestamp || '1970-01-01T00:00:00Z',
        createdBy: result.data.metadata.annotations?.[AnnoKeyCreatedBy] || 'unknown',
        hasAcl: false,
        id: parseInt(result.data.metadata.labels?.[DeprecatedInternalId] || '0', 10) || 0,
        parentUid: result.data.metadata.annotations?.[AnnoKeyFolder],
        managedBy: result.data.metadata.annotations?.[AnnoKeyManagerKind] as ManagerKind,

        parents: resultParents.data.items
          .filter((i) => i.name !== result.data!.metadata.name)
          .map((i) => ({
            title: i.title,
            uid: i.name,
            // No idea how to make slug, on the server: https://github.com/grafana/grafana/blob/aac66e91198004bc044754105e18bfff8fbfd383/pkg/infra/slugify/slugify.go#L56
            url: folderUrl(i.name, ''),
          })),
        title: result.data.spec.title,
        uid: result.data.metadata.name!,
        updated: result.data.metadata.annotations?.[AnnoKeyUpdatedTimestamp] || '1970-01-01T00:00:00Z',
        updatedBy: result.data.metadata.annotations?.[AnnoKeyUpdatedBy] || 'unknown',
        // Seems like this annotation is not populated
        // url: result.data.metadata.annotations?.[AnnoKeyFolderUrl] || '',
        url: folderUrl(result.data.metadata.name!, ''),
        version: result.data.metadata.generation || 1,
      };
    }
    return {
      ...result,
      data: newData,
    };
  } else {
    return useGetFoldersQueryLegacy(uid || skipToken);
  }
}

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Folder, type FolderList } from './endpoints.gen';
