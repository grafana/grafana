import { QueryStatus, skipToken } from '@reduxjs/toolkit/query';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents } from '@grafana/runtime';
import {
  useDeleteFolderMutation as useDeleteFolderMutationLegacy,
  useGetFolderQuery as useGetFolderQueryLegacy,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { FolderDTO } from 'app/types/folders';

import kbn from '../../../../core/utils/kbn';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyManagerKind,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
  ManagerKind,
} from '../../../../features/apiserver/types';
import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/services';
import { refetchChildren } from '../../../../features/browse-dashboards/state/actions';
import { GENERAL_FOLDER_UID } from '../../../../features/search/constants';
import { useDispatch } from '../../../../types/store';
import { useGetDisplayMappingQuery } from '../../iam/v0alpha1';

import { rootFolder, sharedWithMeFolder } from './virtualFolders';

import { useGetFolderQuery, useGetFolderParentsQuery, useDeleteFolderMutation } from './index';

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
  // This may look weird that we call the legacy folder anyway all the time, but the issue is we don't have good API
  // for the access control metadata yet, and so we still take it from the old api.
  // see https://github.com/grafana/identity-access-team/issues/1103
  const legacyFolderResult = useGetFolderQueryLegacy(uid || skipToken);

  if (!config.featureToggles.foldersAppPlatformAPI) {
    return legacyFolderResult;
  }

  const isVirtualFolder = uid && [GENERAL_FOLDER_UID, config.sharedWithMeFolderUID].includes(uid);
  const params = !uid ? skipToken : { name: uid };

  let resultFolder = useGetFolderQuery(isVirtualFolder ? skipToken : params);

  // For virtual folders we simulate the response with hardcoded data.
  if (isVirtualFolder) {
    resultFolder = {
      ...resultFolder,
      status: QueryStatus.fulfilled,
      fulfilledTimeStamp: Date.now(),
      isUninitialized: false,
      error: undefined,
      isError: false,
      isSuccess: true,
      isLoading: false,
      isFetching: false,
      data: GENERAL_FOLDER_UID === uid ? rootFolder : sharedWithMeFolder,
      currentData: GENERAL_FOLDER_UID === uid ? rootFolder : sharedWithMeFolder,
    };
  }

  // We get parents and folders for virtual folders too. Parents should just return empty array but it's easier to
  // stitch the responses this way and access can actually return different response based on the grafana setup.
  const resultParents = useGetFolderParentsQuery(params);

  // Load users info if needed.
  const userKeys = getUserKeys(resultFolder);
  const needsUserData = !isVirtualFolder && Boolean(userKeys.length);
  const resultUserDisplay = useGetDisplayMappingQuery(needsUserData ? { key: userKeys } : skipToken);

  // Stitch together the responses to create a single FolderDTO object so on the outside this behaves as the legacy
  // api client.
  let newData: FolderDTO | undefined = undefined;
  if (
    resultFolder.data &&
    resultParents.data &&
    legacyFolderResult.data &&
    (needsUserData ? resultUserDisplay.data : true)
  ) {
    const updatedBy = resultFolder.data.metadata.annotations?.[AnnoKeyUpdatedBy];
    const createdBy = resultFolder.data.metadata.annotations?.[AnnoKeyCreatedBy];

    newData = {
      canAdmin: legacyFolderResult.data.canAdmin,
      canDelete: legacyFolderResult.data.canDelete,
      canEdit: legacyFolderResult.data.canEdit,
      canSave: legacyFolderResult.data.canSave,
      accessControl: legacyFolderResult.data.accessControl,
      created: resultFolder.data.metadata.creationTimestamp || '0001-01-01T00:00:00Z',
      createdBy:
        (createdBy && resultUserDisplay.data?.display[resultUserDisplay.data?.keys.indexOf(createdBy)]?.displayName) ||
        'Anonymous',
      // Does not seem like this is set to true in the legacy API
      hasAcl: false,
      id: parseInt(resultFolder.data.metadata.labels?.[DeprecatedInternalId] || '0', 10) || 0,
      parentUid: resultFolder.data.metadata.annotations?.[AnnoKeyFolder],
      managedBy: resultFolder.data.metadata.annotations?.[AnnoKeyManagerKind] as ManagerKind,

      title: resultFolder.data.spec.title,
      uid: resultFolder.data.metadata.name!,
      updated: resultFolder.data.metadata.annotations?.[AnnoKeyUpdatedTimestamp] || '0001-01-01T00:00:00Z',
      updatedBy:
        (updatedBy && resultUserDisplay.data?.display[resultUserDisplay.data?.keys.indexOf(updatedBy)]?.displayName) ||
        'Anonymous',
      // Seems like this annotation is not populated
      // url: result.data.metadata.annotations?.[AnnoKeyFolderUrl] || '',
      // general folder does not come with url
      // see https://github.com/grafana/grafana/blob/8a05378ef3ae5545c6f7429eae5c174d3c0edbfe/pkg/services/folder/folderimpl/folder_unifiedstorage.go#L88
      url:
        uid === GENERAL_FOLDER_UID ? '' : getFolderUrl(resultFolder.data.metadata.name!, resultFolder.data.spec.title!),
      version: resultFolder.data.metadata.generation || 1,
    };

    if (resultParents.data.items?.length) {
      newData.parents = resultParents.data.items
        .filter((i) => i.name !== resultFolder.data!.metadata.name)
        .map((i) => ({
          title: i.title,
          uid: i.name,
          // No idea how to make slug, on the server it uses a go lib: https://github.com/grafana/grafana/blob/aac66e91198004bc044754105e18bfff8fbfd383/pkg/infra/slugify/slugify.go#L56
          // Don't think slug is needed for the URL to work though
          url: getFolderUrl(i.name, i.title),
        }));
    }
  }

  // Wrap the stitched data into single RTK query response type object so this looks like a single API call
  return {
    ...resultFolder,
    ...combinedState(resultFolder, resultParents, legacyFolderResult, resultUserDisplay, needsUserData),
    refetch: async () => {
      return Promise.all([
        resultFolder.refetch(),
        resultParents.refetch(),
        legacyFolderResult.refetch(),
        // TODO: Not sure about this, if we refetch this but the response from result change and this is dependant on
        //  that result what are we refetching here? Maybe this is redundant.
        resultUserDisplay.refetch(),
      ]);
    },
    data: newData,
  };
}

export function useDeleteFolderMutationFacade() {
  const [deleteFolder] = useDeleteFolderMutation();
  const [deleteFolderLegacy] = useDeleteFolderMutationLegacy();
  const dispatch = useDispatch();

  return async (folder: FolderDTO) => {
    if (config.featureToggles.foldersAppPlatformAPI) {
      const result = await deleteFolder({ name: folder.uid });
      if (!result.error) {
        // We need to update a legacy version of the folder storage for now until all is in the new API.
        // we could do it in the enhanceEndpoint method but we would also need to change the args as we need parentUID
        // here and so it seemed easier to do it here.
        dispatch(
          refetchChildren({
            parentUID: folder.parentUid || GENERAL_FOLDER_UID,
            pageSize: PAGE_SIZE,
          })
        );
        // Before this was done in backend srv automatically because the old API sent a message wiht 200 request. see
        // public/app/core/services/backend_srv.ts#L341-L361. New API does not do that so we do it here.
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [t('folders.api.folder-deleted-success', 'Folder deleted')],
        });
      }
      return result;
    } else {
      return deleteFolderLegacy(folder);
    }
  };
}

function combinedState(
  result: ReturnType<typeof useGetFolderQuery>,
  resultParents: ReturnType<typeof useGetFolderParentsQuery>,
  resultLegacyFolder: ReturnType<typeof useGetFolderQueryLegacy>,
  resultUserDisplay: ReturnType<typeof useGetDisplayMappingQuery>,
  needsUserData: boolean
) {
  const results = needsUserData
    ? [result, resultParents, resultLegacyFolder, resultUserDisplay]
    : [result, resultParents, resultLegacyFolder];
  return {
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
    isSuccess: results.every((r) => r.isSuccess),
    isError: results.some((r) => r.isError),
    // Only one error will be shown. TODO: somehow create a single error out of them?
    error: results.find((r) => r.error),
  };
}

function getUserKeys(resultFolder: ReturnType<typeof useGetFolderQuery>): string[] {
  return resultFolder.data
    ? [
        resultFolder.data.metadata.annotations?.[AnnoKeyUpdatedBy],
        resultFolder.data.metadata.annotations?.[AnnoKeyCreatedBy],
      ].filter((v) => v !== undefined)
    : [];
}
