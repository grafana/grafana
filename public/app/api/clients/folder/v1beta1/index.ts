import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { FolderDTO } from 'app/types/folders';

import kbn from '../../../../core/utils/kbn';
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
import { useGetFolderQuery as useGetFolderQueryLegacy } from '../../../../features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/services';
import { refetchChildren } from '../../../../features/browse-dashboards/state/actions';
import { GENERAL_FOLDER_UID } from '../../../../features/search/constants';
import { useGetDisplayMappingQuery } from '../../iam/v0alpha1';

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

const { useGetFolderParentsQuery, useGetFolderAccessQuery } = folderAPIv1beta1;
export const { useGetFolderQuery } = folderAPIv1beta1;

function getFolderUrl(uid: string, title: string): string {
  // mimics https://github.com/grafana/grafana/blob/79fe8a9902335c7a28af30e467b904a4ccfac503/pkg/services/dashboards/models.go#L188
  // Not the same slugify as on the backend https://github.com/grafana/grafana/blob/aac66e91198004bc044754105e18bfff8fbfd383/pkg/infra/slugify/slugify.go#L86
  // Probably does not matter as it seems to be only for better human readability.
  const slug = kbn.slugifyForUrl(title);
  return `${config.appSubUrl}/dashboards/f/${uid}/${slug}`;
}

/**
 * A proxy function that uses either legacy folder client or the new app platform APIs to get the data in the same
 * format of a FolderDTO object. As the schema isn't the same, using the app platform needs multiple different calls
 * which are then stitched together.
 * @param uid
 */
export function useGetFolderQueryFacade(uid?: string) {
  if (config.featureToggles.foldersAppPlatformAPI) {
    const result = useGetFolderQuery(uid ? { name: uid } : skipToken);
    const resultParents = useGetFolderParentsQuery(uid ? { name: uid } : skipToken);
    const resultAccess = useGetFolderAccessQuery(uid ? { name: uid } : skipToken);

    const keys: string[] = result.data
      ? [
          result.data.metadata.annotations?.[AnnoKeyUpdatedBy],
          result.data.metadata.annotations?.[AnnoKeyCreatedBy],
        ].filter((v) => v !== undefined)
      : [];

    const resultUserDisplay = useGetDisplayMappingQuery(keys.length ? { key: keys } : skipToken);

    let newData: FolderDTO | undefined = undefined;
    if (result.data && resultParents.data && resultAccess.data && resultUserDisplay.data) {
      const updatedBy = result.data.metadata.annotations?.[AnnoKeyUpdatedBy];
      const createdBy = result.data.metadata.annotations?.[AnnoKeyCreatedBy];
      newData = {
        canAdmin: resultAccess.data.canAdmin,
        canDelete: resultAccess.data.canDelete,
        canEdit: resultAccess.data.canEdit,
        canSave: resultAccess.data.canSave,
        accessControl: resultAccess.data.accessControl,
        created: result.data.metadata.creationTimestamp || '0001-01-01T00:00:00Z',
        createdBy:
          (createdBy && resultUserDisplay.data.display[resultUserDisplay.data.keys.indexOf(createdBy)]?.displayName) ||
          'Anonymous',
        // Does not seem like this is set to true in the legacy API
        hasAcl: false,
        id: parseInt(result.data.metadata.labels?.[DeprecatedInternalId] || '0', 10) || 0,
        parentUid: result.data.metadata.annotations?.[AnnoKeyFolder],
        managedBy: result.data.metadata.annotations?.[AnnoKeyManagerKind] as ManagerKind,

        title: result.data.spec.title,
        uid: result.data.metadata.name!,
        updated: result.data.metadata.annotations?.[AnnoKeyUpdatedTimestamp] || '0001-01-01T00:00:00Z',
        updatedBy:
          (updatedBy && resultUserDisplay.data.display[resultUserDisplay.data.keys.indexOf(updatedBy)]?.displayName) ||
          'Anonymous',
        // Seems like this annotation is not populated
        // url: result.data.metadata.annotations?.[AnnoKeyFolderUrl] || '',
        // general folder does not come with url
        // see https://github.com/grafana/grafana/blob/8a05378ef3ae5545c6f7429eae5c174d3c0edbfe/pkg/services/folder/folderimpl/folder_unifiedstorage.go#L88
        url: uid === GENERAL_FOLDER_UID ? '' : getFolderUrl(result.data.metadata.name!, result.data.spec.title!),
        version: result.data.metadata.generation || 1,
      };

      if (resultParents.data.items?.length) {
        newData.parents = resultParents.data.items
          .filter((i) => i.name !== result.data!.metadata.name)
          .map((i) => ({
            title: i.title,
            uid: i.name,
            // No idea how to make slug, on the server it uses a go lib: https://github.com/grafana/grafana/blob/aac66e91198004bc044754105e18bfff8fbfd383/pkg/infra/slugify/slugify.go#L56
            // Don't think slug is needed for the URL to work though
            url: getFolderUrl(i.name, i.title),
          }));
      }
    }

    return {
      ...result,
      isLoading:
        result.isLoading ||
        resultParents.isLoading ||
        resultAccess.isLoading ||
        (keys.length ? resultUserDisplay.isLoading : false),
      isFetching:
        result.isFetching ||
        resultParents.isFetching ||
        resultAccess.isFetching ||
        (keys.length ? resultUserDisplay.isFetching : false),
      isSuccess:
        result.isSuccess &&
        resultParents.isSuccess &&
        resultAccess.isSuccess &&
        (keys.length ? resultUserDisplay.isSuccess : true),
      isError:
        result.isError ||
        resultParents.isError ||
        resultAccess.isError ||
        (keys.length ? resultUserDisplay.isError : false),

      // Only one error will be shown. TODO: somehow create a single error out of them?
      error:
        result.error ||
        resultParents.error ||
        resultAccess.error ||
        (keys.length ? resultUserDisplay.error : undefined),

      refetch: async () => {
        return Promise.all([
          result.refetch(),
          resultParents.refetch(),
          resultAccess.refetch(),
          // TODO: Not sure about this, if we refetch this but the response from result change and this is dependant on
          //  that result what are we refetching here? Maybe this is redundant.
          resultUserDisplay.refetch(),
        ]);
      },
      data: newData,
    };
  } else {
    return useGetFolderQueryLegacy(uid || skipToken);
  }
}

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Folder, type FolderList } from './endpoints.gen';
