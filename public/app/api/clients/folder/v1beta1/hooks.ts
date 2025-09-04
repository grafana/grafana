import { QueryStatus, skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  useDeleteFolderMutation as useDeleteFolderMutationLegacy,
  useGetFolderQuery as useGetFolderQueryLegacy,
  useDeleteFoldersMutation as useDeleteFoldersMutationLegacy,
  useNewFolderMutation as useLegacyNewFolderMutation,
  useMoveFoldersMutation as useMoveFoldersMutationLegacy,
  useSaveFolderMutation as useLegacySaveFolderMutation,
  useMoveFolderMutation as useMoveFolderMutationLegacy,
  MoveFoldersArgs,
  DeleteFoldersArgs,
  MoveFolderArgs,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';
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
import { useDispatch } from '../../../../types/store';
import { useLazyGetDisplayMappingQuery } from '../../iam/v0alpha1';

import { isProvisionedFolderCheck } from './utils';
import { rootFolder, sharedWithMeFolder } from './virtualFolders';

import {
  useGetFolderQuery,
  useGetFolderParentsQuery,
  useDeleteFolderMutation,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  Folder,
  CreateFolderApiArg,
  useReplaceFolderMutation,
  ReplaceFolderApiArg,
} from './index';

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
    const userKeys = getUserKeys(resultFolder);
    return !isVirtualFolder && Boolean(userKeys.length);
  }, [isVirtualFolder, resultFolder]);

  useEffect(() => {
    const userKeys = getUserKeys(resultFolder);
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
    const updatedBy = resultFolder.data.metadata.annotations?.[AnnoKeyUpdatedBy];
    const createdBy = resultFolder.data.metadata.annotations?.[AnnoKeyCreatedBy];

    const parsed = appPlatformFolderToLegacyFolder(resultFolder.data);

    newData = {
      canAdmin: legacyFolderResult.data.canAdmin,
      canDelete: legacyFolderResult.data.canDelete,
      canEdit: legacyFolderResult.data.canEdit,
      canSave: legacyFolderResult.data.canSave,
      accessControl: legacyFolderResult.data.accessControl,

      createdBy:
        (createdBy && resultUserDisplay.data?.display[resultUserDisplay.data?.keys.indexOf(createdBy)]?.displayName) ||
        'Anonymous',

      updatedBy:
        (updatedBy && resultUserDisplay.data?.display[resultUserDisplay.data?.keys.indexOf(updatedBy)]?.displayName) ||
        'Anonymous',
      ...parsed,
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
      return Promise.all([resultFolder.refetch(), resultParents.refetch(), legacyFolderResult.refetch()]);
    },
    data: newData,
  };
}

export function useDeleteFolderMutationFacade() {
  const [deleteFolder] = useDeleteFolderMutation();
  const [deleteFolderLegacy] = useDeleteFolderMutationLegacy();
  const refresh = useRefreshFolders();
  const notify = useAppNotification();

  return async (folder: FolderDTO) => {
    if (config.featureToggles.foldersAppPlatformAPI) {
      const result = await deleteFolder({ name: folder.uid });
      if (!result.error) {
        // we could do this in the enhanceEndpoint method, but we would also need to change the args as we need parentUID
        // here and so it seemed easier to do it here.
        refresh({ childrenOf: folder.parentUid });
        // Before this was done in backend srv automatically because the old API sent a message wiht 200 request. see
        // public/app/core/services/backend_srv.ts#L341-L361. New API does not do that so we do it here.
        notify.success(t('folders.api.folder-deleted-success', 'Folder deleted'));
      }
      return result;
    } else {
      return deleteFolderLegacy(folder);
    }
  };
}

export function useDeleteMultipleFoldersMutationFacade() {
  const [deleteFolders] = useDeleteFoldersMutationLegacy();
  const [deleteFolder] = useDeleteFolderMutation();
  const dispatch = useDispatch();
  const refresh = useRefreshFolders();

  if (!config.featureToggles.foldersAppPlatformAPI) {
    return deleteFolders;
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

function getUserKeys(resultFolder: ReturnType<typeof useGetFolderQuery>): string[] {
  return resultFolder.data
    ? [
        resultFolder.data.metadata.annotations?.[AnnoKeyUpdatedBy],
        resultFolder.data.metadata.annotations?.[AnnoKeyCreatedBy],
      ].filter((v) => v !== undefined)
    : [];
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
