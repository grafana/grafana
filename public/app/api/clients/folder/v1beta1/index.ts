import { config } from '@grafana/runtime';

import { AnnoKeyCreatedBy, AnnoKeyFolder, AnnoKeyUpdatedTimestamp } from '../../../../features/apiserver/types';
import { useGetFolderQuery as useGetFoldersQueryLegacy } from '../../../../features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/services';
import { refetchChildren } from '../../../../features/browse-dashboards/state';
import { GENERAL_FOLDER_UID } from '../../../../features/search/constants';

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

export const { useGetFolderQuery } = folderAPIv1beta1;

export function useGetFolderQueryFacade(uid: string) {
  if (config.featureToggles.foldersAppPlatformAPI) {
    return useGetFolderQuery({ name: uid });
  } else {
    const result = useGetFoldersQueryLegacy(uid);
    if (result.data) {
      const newData: Folder = {
        metadata: {
          annotations: {
            [AnnoKeyCreatedBy]: result.data.createdBy,
            [AnnoKeyUpdatedTimestamp]: result.data.updated,
            [AnnoKeyFolder]: result.data.parentUid,
          },
          creationTimestamp: result.data.created,
          name: result.data.uid,
        },
        spec: {
          description: result.data.description,
          title: result.data.title,
        },
        status: {},
      };
      return {
        ...result,
        data: newData,
      };
    }
    return result;
  }
}

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Folder, type GetFolderChildrenApiResponse } from './endpoints.gen';
