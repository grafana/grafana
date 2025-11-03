import { QueryStatus, skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents } from '@grafana/runtime';
import { DisplayList, iamAPIv0alpha1, useLazyGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { legacyAPI } from 'app/api/clients/legacy';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  useDeleteFolderMutation as useDeleteFolderMutationLegacy,
  useGetFolderQuery as useGetFolderQueryLegacy,
  useDeleteFoldersMutation as useDeleteFoldersMutationLegacy,
  useNewFolderMutation as useLegacyNewFolderMutation,
  useMoveFoldersMutation as useMoveFoldersMutationLegacy,
  useSaveFolderMutation as useLegacySaveFolderMutation,
  useMoveFolderMutation as useMoveFolderMutationLegacy,
  useGetAffectedItemsQuery as useLegacyGetAffectedItemsQuery,
  MoveFoldersArgs,
  DeleteFoldersArgs,
  MoveFolderArgs,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { dispatch } from 'app/store/store';
import { FolderDTO, NewFolder } from 'app/types/folders';

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
import { refetchChildren, refreshParents } from '../../../../features/browse-dashboards/state/actions';
import { GENERAL_FOLDER_UID } from '../../../../features/search/constants';
import { deletedDashboardsCache } from '../../../../features/search/service/deletedDashboardsCache';
import { useDispatch } from '../../../../types/store';

import { isProvisionedFolderCheck } from './utils';
import { rootFolder, sharedWithMeFolder } from './virtualFolders';

import {
  folderAPIv1beta1,
  useGetFolderQuery,
  useGetFolderParentsQuery,
  useDeleteFolderMutation,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  Folder,
  CreateFolderApiArg,
  useReplaceFolderMutation,
  ReplaceFolderApiArg,
  useGetAffectedItemsQuery,
  FolderInfo,
} from './index';

function getFolderUrl(uid: string, title: string): string {
  // mimics https://github.com/grafana/grafana/blob/79fe8a9902335c7a28af30e467b904a4ccfac503/pkg/services/dashboards/models.go#L188
  // Not the same slugify as on the backend https://github.com/grafana/grafana/blob/aac66e91198004bc044754105e18bfff8fbfd383/pkg/infra/slugify/slugify.go#L86
  // Probably does not matter as it seems to be only for better human readability.
  const slug = kbn.slugifyForUrl(title);
  return `${config.appSubUrl}/dashboards/f/${uid}/${slug}`;
}

const combineFolderResponses = (
  folder: Folder,
  legacyFolder: FolderDTO,
  parents: FolderInfo[],
  userDisplay?: DisplayList
) => {
  const updatedBy = folder.metadata.annotations?.[AnnoKeyUpdatedBy];
  const createdBy = folder.metadata.annotations?.[AnnoKeyCreatedBy];

  const newData: FolderDTO = {
    canAdmin: legacyFolder.canAdmin,
    canDelete: legacyFolder.canDelete,
    canEdit: legacyFolder.canEdit,
    canSave: legacyFolder.canSave,
    accessControl: legacyFolder.accessControl,
    createdBy: (createdBy && userDisplay?.display[userDisplay?.keys.indexOf(createdBy)]?.displayName) || 'Anonymous',
    updatedBy: (updatedBy && userDisplay?.display[userDisplay?.keys.indexOf(updatedBy)]?.displayName) || 'Anonymous',
    ...appPlatformFolderToLegacyFolder(folder),
  };

  if (parents.length) {
    newData.parents = parents
      .filter((i) => i.name !== folder.metadata.name)
      .map(({ name, title }) => ({
        title: title,
        uid: name,
        // No idea how to make slug, on the server it uses a go lib: https://github.com/grafana/grafana/blob/aac66e91198004bc044754105e18bfff8fbfd383/pkg/infra/slugify/slugify.go#L56
        // Don't think slug is needed for the URL to work though
        url: getFolderUrl(name, title),
      }));
  }

  return newData;
};

export async function getFolderByUidFacade(uid: string): Promise<FolderDTO> {
  const isVirtualFolder = uid && [GENERAL_FOLDER_UID, config.sharedWithMeFolderUID].includes(uid);
  // We need the legacy API call regardless, for now
  const legacyApiCall = dispatch(legacyAPI.endpoints.getFolderByUid.initiate({ folderUid: uid }));

  const shouldUseAppPlatformAPI = Boolean(config.featureToggles.foldersAppPlatformAPI);
  if (shouldUseAppPlatformAPI) {
    let virtualFolderResponse;
    if (isVirtualFolder) {
      virtualFolderResponse = GENERAL_FOLDER_UID === uid ? rootFolder : sharedWithMeFolder;
    }

    const responses = await Promise.all([
      // We still need to call legacy endpoints for access control metadata
      legacyApiCall,
      isVirtualFolder
        ? Promise.resolve(virtualFolderResponse)
        : dispatch(folderAPIv1beta1.endpoints.getFolder.initiate({ name: uid })),
      dispatch(folderAPIv1beta1.endpoints.getFolderParents.initiate({ name: uid })),
    ]);

    const [legacyFolderResponse, folderResponse, parentsResponse] = responses;

    const userKeys = getUserKeys(folderResponse.data);
    let userResponse;
    if (userKeys.length) {
      userResponse = await dispatch(iamAPIv0alpha1.endpoints.getDisplayMapping.initiate({ key: userKeys }));
    }

    return combineFolderResponses(
      folderResponse.data,
      legacyFolderResponse.data,
      parentsResponse.data,
      userResponse.data
    );
  }

  const legacyFolderResponse = await legacyApiCall;

  if (legacyFolderResponse.error || !legacyFolderResponse.data) {
    throw legacyFolderResponse.error || new Error('Legacy folder response is undefined');
  }

  return legacyFolderResponse.data;
}

/**
 * A proxy function that uses either legacy folder client or the new app platform APIs to get the data in the same
 * format of a FolderDTO object. As the schema isn't the same, using the app platform needs multiple different calls
 * which are then stitched together.
 * @param uid
 */
export function useGetFolderQueryFacade(uid?: string) {
  const shouldUseAppPlatformAPI = Boolean(config.featureToggles.foldersAppPlatformAPI);
  const isVirtualFolder = uid && [GENERAL_FOLDER_UID, config.sharedWithMeFolderUID].includes(uid);
  const params = !uid ? skipToken : { name: uid };

  // This may look weird that we call the legacy folder anyway all the time, but the issue is we don't have good API
  // for the access control metadata yet, and so we still take it from the old api.
  // see https://github.com/grafana/identity-access-team/issues/1103
  const legacyFolderResult = useGetFolderQueryLegacy(uid || skipToken);
  let resultFolder = useGetFolderQuery(shouldUseAppPlatformAPI && !isVirtualFolder ? params : skipToken);
  // We get parents and folders for virtual folders too. Parents should just return empty array but it's easier to
  // stitch the responses this way and access can actually return different response based on the grafana setup.
  const resultParents = useGetFolderParentsQuery(shouldUseAppPlatformAPI ? params : skipToken);
  const [triggerGetUserDisplayMapping, resultUserDisplay] = useLazyGetDisplayMappingQuery();

  const needsUserData = useMemo(() => {
    const userKeys = getUserKeys(resultFolder.data);
    return !isVirtualFolder && Boolean(userKeys.length);
  }, [isVirtualFolder, resultFolder]);

  useEffect(() => {
    const userKeys = getUserKeys(resultFolder.data);
    if (needsUserData && userKeys.length) {
      triggerGetUserDisplayMapping({ key: userKeys }, true);
    }
  }, [needsUserData, resultFolder, triggerGetUserDisplayMapping]);

  if (!shouldUseAppPlatformAPI) {
    return legacyFolderResult;
  }

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

  // Stitch together the responses to create a single FolderDTO object so on the outside this behaves as the legacy
  // api client.
  let newData: FolderDTO | undefined = undefined;
  if (
    resultFolder.data &&
    resultParents.data &&
    legacyFolderResult.data &&
    (needsUserData ? resultUserDisplay.data : true)
  ) {
    newData = combineFolderResponses(
      resultFolder.data,
      legacyFolderResult.data,
      resultParents.data.items,
      resultUserDisplay.data
    );
  }

  // Wrap the stitched data into single RTK query response type object so this looks like a single API call
  return {
    ...resultFolder,
    ...combinedState(resultFolder, resultParents, legacyFolderResult, resultUserDisplay, needsUserData),
    refetch: async () => {
      return Promise.all([resultFolder.refetch(), resultParents.refetch(), legacyFolderResult.refetch()]);
    },
    data: newData,
  };
}

export function useDeleteFolderMutationFacade() {
  const [deleteFolderMutation] = useDeleteFolderMutation();
  const [deleteFolderLegacy] = useDeleteFolderMutationLegacy();
  const refresh = useRefreshFolders();
  const notify = useAppNotification();

  // TODO right now the app platform backend does not support cascading delete of children so we cannot use it.
  const isBackendSupport = false;
  if (!(config.featureToggles.foldersAppPlatformAPI && isBackendSupport)) {
    return deleteFolderLegacy;
  }

  return async function deleteFolder(folder: FolderDTO) {
    const result = await deleteFolderMutation({ name: folder.uid });
    if (!result.error) {
      // we could do this in the enhanceEndpoint method, but we would also need to change the args as we need parentUID
      // here and so it seemed easier to do it here.
      refresh({ childrenOf: folder.parentUid });
      // Before this was done in backend srv automatically because the old API sent a message wiht 200 request. see
      // public/app/core/services/backend_srv.ts#L341-L361. New API does not do that so we do it here.
      notify.success(t('folders.api.folder-deleted-success', 'Folder deleted'));
    }
    return result;
  };
}

export function useDeleteMultipleFoldersMutationFacade() {
  const [deleteFoldersLegacy] = useDeleteFoldersMutationLegacy();
  const [deleteFolder] = useDeleteFolderMutation();
  const dispatch = useDispatch();
  const refresh = useRefreshFolders();

  // TODO right now the app platform backend does not support cascading delete of children so we cannot use it.
  const isBackendSupport = false;
  if (!(config.featureToggles.foldersAppPlatformAPI && isBackendSupport)) {
    return deleteFoldersLegacy;
  }

  return async function deleteFolders({ folderUIDs }: DeleteFoldersArgs) {
    const successMessage = t('folders.api.folder-deleted-success', 'Folder deleted');

    // Delete all the folders sequentially
    // TODO error handling here
    for (const folderUID of folderUIDs) {
      // This also shows warning alert
      const isProvisioned = await isProvisionedFolderCheck(dispatch, folderUID);

      if (!isProvisioned) {
        const result = await deleteFolder({ name: folderUID });
        if (!result.error) {
          // Before this was done in backend srv automatically because the old API sent a message wiht 200 request. see
          // public/app/core/services/backend_srv.ts#L341-L361. New API does not do that so we do it here.
          getAppEvents().publish({
            type: AppEvents.alertSuccess.name,
            payload: [successMessage],
          });
        }
      }
    }

    refresh({ parentsOf: folderUIDs });
    return { data: undefined };
  };
}

export function useMoveMultipleFoldersMutationFacade() {
  const moveFoldersLegacyResult = useMoveFoldersMutationLegacy();
  const [updateFolder, updateFolderData] = useUpdateFolderMutation();
  const dispatch = useDispatch();
  const refetch = useRefreshFolders();

  if (!config.featureToggles.foldersAppPlatformAPI) {
    return moveFoldersLegacyResult;
  }

  async function moveFolders({ folderUIDs, destinationUID }: MoveFoldersArgs) {
    const provisionedWarning = t(
      'folders.api.folder-move-error-provisioned',
      'Cannot move provisioned folder. To move it, move it in the repository and synchronise to apply the changes.'
    );
    const successMessage = t('folders.api.folder-moved-success', 'Folder moved');

    // Move all the folders sequentially one by one
    for (const folderUID of folderUIDs) {
      // isProvisionedFolderCheck also shows a warning alert
      const isFolderProvisioned = await isProvisionedFolderCheck(dispatch, folderUID, { warning: provisionedWarning });

      // If provisioned, we just skip this folder
      if (!isFolderProvisioned) {
        const result = await updateFolder({
          name: folderUID,
          patch: { metadata: { annotations: { [AnnoKeyFolder]: destinationUID } } },
        });
        if (!result.error) {
          getAppEvents().publish({
            type: AppEvents.alertSuccess.name,
            payload: [successMessage],
          });
        }
      }
    }
    refetch({ childrenOf: destinationUID, parentsOf: folderUIDs });
    return { data: undefined };
  }

  return [moveFolders, updateFolderData] as const;
}

export function useCreateFolder() {
  const [createFolder, result] = useCreateFolderMutation();
  const legacyHook = useLegacyNewFolderMutation();
  const refresh = useRefreshFolders();

  if (!config.featureToggles.foldersAppPlatformAPI) {
    return legacyHook;
  }

  const createFolderAppPlatform = async (folder: NewFolder) => {
    const payload: CreateFolderApiArg = {
      folder: {
        spec: {
          title: folder.title,
        },
        metadata: {
          generateName: 'f',
          annotations: {
            ...(folder.parentUid && { [AnnoKeyFolder]: folder.parentUid }),
          },
        },
        status: {},
      },
    };

    const result = await createFolder(payload);
    refresh({ childrenOf: folder.parentUid });
    deletedDashboardsCache.clear();

    return {
      ...result,
      data: result.data ? appPlatformFolderToLegacyFolder(result.data) : undefined,
    };
  };

  return [createFolderAppPlatform, result] as const;
}

export function useUpdateFolder() {
  const [updateFolder, result] = useReplaceFolderMutation();
  const legacyHook = useLegacySaveFolderMutation();
  const refresh = useRefreshFolders();

  if (!config.featureToggles.foldersAppPlatformAPI) {
    return legacyHook;
  }

  const updateFolderAppPlatform = async (folder: Pick<FolderDTO, 'uid' | 'title' | 'version' | 'parentUid'>) => {
    const payload: ReplaceFolderApiArg = {
      name: folder.uid,
      folder: {
        spec: { title: folder.title },
        metadata: {
          name: folder.uid,
        },
        status: {},
      },
    };

    const result = await updateFolder(payload);
    refresh({ childrenOf: folder.parentUid });

    return {
      ...result,
      data: result.data ? appPlatformFolderToLegacyFolder(result.data) : undefined,
    };
  };

  return [updateFolderAppPlatform, result] as const;
}

export function useMoveFolderMutationFacade() {
  const [updateFolder, updateFolderData] = useUpdateFolderMutation();
  const moveFolderResult = useMoveFolderMutationLegacy();
  const refresh = useRefreshFolders();
  const notify = useAppNotification();

  if (!config.featureToggles.foldersAppPlatformAPI) {
    return moveFolderResult;
  }

  async function moveFolder({ folderUID, destinationUID }: MoveFolderArgs) {
    const result = await updateFolder({
      name: folderUID,
      patch: { metadata: { annotations: { [AnnoKeyFolder]: destinationUID } } },
    });
    if (!result.error) {
      refresh({ parentsOf: [folderUID], childrenOf: destinationUID });
      // Before this was done in backend srv automatically because the old API sent a message with 200 request. see
      // public/app/core/services/backend_srv.ts#L341-L361. New API does not do that so we do it here.
      notify.success(t('folders.api.folder-moved-success', 'Folder moved'));
    }
    return result;
  }

  return [moveFolder, updateFolderData] as const;
}

/**
 * Refresh the state of the folders to update the UI after folders are updated. This refreshes legacy storage
 * of the folder structure outside the RTK query. Once all is migrated to new API this should not be needed.
 */
function useRefreshFolders() {
  const dispatch = useDispatch();

  return (options: { parentsOf?: string[]; childrenOf?: string }) => {
    if (options.parentsOf) {
      dispatch(refreshParents(options.parentsOf));
    }
    // Refetch children even if we passed in `childrenOf: undefined`, as this corresponds to the root folder
    if (options.childrenOf || 'childrenOf' in options) {
      dispatch(
        refetchChildren({
          parentUID: options.childrenOf,
          pageSize: PAGE_SIZE,
        })
      );
    }
  };
}

export function useGetAffectedItems({ folder, dashboard }: Pick<DashboardTreeSelection, 'folder' | 'dashboard'>) {
  const folderUIDs = Object.keys(folder).filter((uid) => folder[uid]);
  const dashboardUIDs = Object.keys(dashboard).filter((uid) => dashboard[uid]);

  // TODO: Remove constant condition here once we have a solution for the app platform counts
  // As of now, the counts are not calculated recursively, so we need to use the legacy API
  const shouldUseAppPlatformAPI = false && Boolean(config.featureToggles.foldersAppPlatformAPI);
  const hookParams:
    | Parameters<typeof useLegacyGetAffectedItemsQuery>[0]
    | Parameters<typeof useGetAffectedItemsQuery>[0] = {
    folderUIDs,
    dashboardUIDs,
  };

  const legacyResult = useLegacyGetAffectedItemsQuery(!shouldUseAppPlatformAPI ? hookParams : skipToken);
  const appPlatformResult = useGetAffectedItemsQuery(shouldUseAppPlatformAPI ? hookParams : skipToken);

  return shouldUseAppPlatformAPI ? appPlatformResult : legacyResult;
}

function combinedState(
  result: ReturnType<typeof useGetFolderQuery>,
  resultParents: ReturnType<typeof useGetFolderParentsQuery>,
  resultLegacyFolder: ReturnType<typeof useGetFolderQueryLegacy>,
  resultUserDisplay: ReturnType<typeof useLazyGetDisplayMappingQuery>[1],
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

function getUserKeys(folder?: Folder): string[] {
  return [folder?.metadata.annotations?.[AnnoKeyUpdatedBy], folder?.metadata.annotations?.[AnnoKeyCreatedBy]].filter(
    (v) => v !== undefined
  );
}

const appPlatformFolderToLegacyFolder = (
  folder: Folder
): Omit<FolderDTO, 'parents' | 'canSave' | 'canEdit' | 'canAdmin' | 'canDelete' | 'createdBy' | 'updatedBy'> => {
  // Omits properties that we can't easily get solely from the app platform response
  // In some cases, these properties aren't used on the response of the hook,
  // so it's best to discourage from using them anyway

  const { annotations, name = '', creationTimestamp, generation, labels } = folder.metadata;
  const { title = '' } = folder.spec;
  return {
    id: parseInt(labels?.[DeprecatedInternalId] || '0', 10) || 0,
    uid: name,
    title,
    // general folder does not come with url
    // see https://github.com/grafana/grafana/blob/8a05378ef3ae5545c6f7429eae5c174d3c0edbfe/pkg/services/folder/folderimpl/folder_unifiedstorage.go#L88
    url: name === GENERAL_FOLDER_UID ? '' : getFolderUrl(name, title),
    created: creationTimestamp || '0001-01-01T00:00:00Z',
    updated: annotations?.[AnnoKeyUpdatedTimestamp] || '0001-01-01T00:00:00Z',
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    managedBy: annotations?.[AnnoKeyManagerKind] as ManagerKind,
    parentUid: annotations?.[AnnoKeyFolder],
    version: generation || 1,
    hasAcl: false,
  };
};
