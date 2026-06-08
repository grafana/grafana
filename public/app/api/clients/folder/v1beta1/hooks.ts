import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';

import { invalidateQuotaUsage } from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents } from '@grafana/runtime';
import {
  API_GROUP as IAM_API_GROUP,
  API_VERSION as IAM_API_VERSION,
  type DisplayList,
  iamAPIv0alpha1,
  useLazyGetDisplayMappingQuery,
} from 'app/api/clients/iam/v0alpha1';
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
  type MoveFoldersArgs,
  type DeleteFoldersArgs,
  type MoveFolderArgs,
  browseDashboardsAPI,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { type DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { type FolderDTO, type NewFolder } from 'app/types/folders';
import { dispatch } from 'app/types/store';

import kbn from '../../../../core/utils/kbn';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyManagerKind,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
  type ManagerKind,
} from '../../../../features/apiserver/types';
import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/constants';
import { refetchChildren, refreshParents } from '../../../../features/browse-dashboards/state/actions';
import { isRootFolderUID } from '../../../../features/search/constants';
import { deletedDashboardsCache } from '../../../../features/search/service/deletedDashboardsCache';
import { useDispatch } from '../../../../types/store';

import { isProvisionedFolderCheck } from './utils';
import { rootFolder, sharedWithMeFolder } from './virtualFolders';

import {
  folderAPIv1beta1,
  useGetFolderQuery,
  useGetFolderAccessQuery,
  useGetFolderParentsQuery,
  useDeleteFolderMutation,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  type Folder,
  type FolderAccessInfo,
  type CreateFolderApiArg,
  type UpdateFolderApiArg,
  useGetAffectedItemsQuery,
  type FolderInfo,
  type ObjectMeta,
  type OwnerReference,
} from './index';

export function getFolderUrl(uid: string, title: string): string {
  // slugifyForUrl strips non-ASCII characters, so for titles composed entirely of non-Latin
  // characters (CJK, Cyrillic, Arabic, etc.) the slug is empty. Fall back to uid to avoid
  // double-slash URLs that break route matching.
  const slug = kbn.slugifyForUrl(title).replace(/^-+|-+$/g, '') || uid;
  return `${config.appSubUrl}/dashboards/f/${uid}/${slug}`;
}

/**
 * FolderDTO with optional ownerReferences
 *
 * (owner references will only be populated with app platform API + team folders functionality)
 */
export type CombinedFolder = FolderDTO & {
  ownerReferences?: OwnerReference[];
};

function resolveDisplayName(userKey: string | undefined, userDisplay?: DisplayList): string {
  const anonymous = t('folders.api.anonymous-user', 'Anonymous');
  if (!userKey) {
    return anonymous;
  }
  const idx = userDisplay?.keys?.indexOf(userKey) ?? -1;
  if (idx < 0) {
    return anonymous;
  }
  return userDisplay?.display?.[idx]?.displayName || anonymous;
}

const combineFolderResponses = (
  folder: Folder,
  access: FolderAccessInfo,
  parents: FolderInfo[],
  userDisplay?: DisplayList
) => {
  const newData: CombinedFolder = {
    canAdmin: access.canAdmin,
    canDelete: access.canDelete,
    canEdit: access.canEdit,
    canSave: access.canSave,
    accessControl: access.accessControl,
    createdBy: resolveDisplayName(folder.metadata.annotations?.[AnnoKeyCreatedBy], userDisplay),
    updatedBy: resolveDisplayName(folder.metadata.annotations?.[AnnoKeyUpdatedBy], userDisplay),
    ...appPlatformFolderToLegacyFolder(folder),
    ownerReferences: folder.metadata.ownerReferences || [],
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

export async function getFolderByUidFacade(uid: string) {
  // Root-parented requests carry "" or "general" — serve the virtual root
  // folder for either rather than fetching a folder resource that doesn't exist.
  const isRoot = isRootFolderUID(uid);
  const isVirtualFolder = uid && (isRoot || uid === config.sharedWithMeFolderUID);
  const shouldUseAppPlatformAPI = Boolean(config.featureToggles.foldersAppPlatformAPI);

  if (shouldUseAppPlatformAPI) {
    // Virtual folders aren't real resources, so the folder object comes from a
    // hardcoded constant and they have no parents. Access is still a real query —
    // the backend returns proper access info for the root and "shared with me" folders.
    if (isVirtualFolder) {
      const accessResponse = await dispatch(folderAPIv1beta1.endpoints.getFolderAccess.initiate({ name: uid }));
      if (!accessResponse?.data) {
        throw accessResponse.error || new Error('Folder access response is undefined');
      }
      return combineFolderResponses(isRoot ? rootFolder : sharedWithMeFolder, accessResponse.data, []);
    }

    const responses = await Promise.all([
      dispatch(folderAPIv1beta1.endpoints.getFolderAccess.initiate({ name: uid })),
      dispatch(folderAPIv1beta1.endpoints.getFolder.initiate({ name: uid })),
      dispatch(folderAPIv1beta1.endpoints.getFolderParents.initiate({ name: uid })),
    ]);

    const [accessResponse, folderResponse, parentsResponse] = responses;

    if (!folderResponse?.data || !accessResponse?.data || !parentsResponse?.data) {
      // Throw the original error (with HTTP status) so callers can detect e.g. 403 and
      // gracefully continue — this handles the case when a user has access to a dashboard
      // but not to the containing folder.
      const error = folderResponse.error || parentsResponse.error || accessResponse.error;
      throw error || new Error('One of the folder responses is undefined');
    }

    const userKeys = getUserKeys(folderResponse.data);
    let userResponse;
    if (userKeys.length) {
      userResponse = await dispatch(iamAPIv0alpha1.endpoints.getDisplayMapping.initiate({ key: userKeys }));
    }

    return combineFolderResponses(
      folderResponse.data,
      accessResponse.data,
      parentsResponse.data.items,
      userResponse?.data
    );
  }

  const legacyFolderResponse = await dispatch(
    browseDashboardsAPI.endpoints.getFolder.initiate({
      folderUID: uid,
      accesscontrol: true,
      isLegacyCall: false,
    })
  );

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
  // "" / undefined and "general" both mean the synthetic root folder —
  // neither is a real folder resource.
  const isRoot = isRootFolderUID(uid);
  const isVirtualFolder = uid && (isRoot || uid === config.sharedWithMeFolderUID);
  const params = !uid ? skipToken : { name: uid };

  const legacyFolderResult = useGetFolderQueryLegacy(
    !shouldUseAppPlatformAPI && uid ? { folderUID: uid, accesscontrol: true, isLegacyCall: false } : skipToken
  );
  // The folder object itself isn't fetched for virtual folders (the resource
  // doesn't exist), but access is a real query for them — the backend returns
  // proper access info for the root and "shared with me" folders.
  const resultFolder = useGetFolderQuery(shouldUseAppPlatformAPI && !isVirtualFolder ? params : skipToken);
  const resultAccess = useGetFolderAccessQuery(shouldUseAppPlatformAPI ? params : skipToken);
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

  // For virtual folders the folder object is hardcoded and there are no parents, but access
  // is a real query whose loading/error state we surface directly.
  if (isVirtualFolder) {
    const folder = isRoot ? rootFolder : sharedWithMeFolder;
    const data = resultAccess.data ? combineFolderResponses(folder, resultAccess.data, []) : undefined;

    // Wrap the stitched data into single RTK query response type object so this looks like a single API call
    return {
      ...resultAccess,
      data,
      currentData: data,
      refetch: async () => {
        return Promise.all([resultParents.refetch(), resultAccess.refetch()]);
      },
    };
  } else {
    // Stitch together the responses to create a single FolderDTO object so on the outside this behaves as the legacy
    // api client.
    let newData: CombinedFolder | undefined;
    if (resultFolder.data && resultParents.data && resultAccess.data && (!needsUserData || resultUserDisplay.data)) {
      newData = combineFolderResponses(
        resultFolder.data,
        resultAccess.data,
        resultParents.data.items,
        resultUserDisplay.data
      );
    }

    // Wrap the stitched data into single RTK query response type object so this looks like a single API call
    return {
      ...resultFolder,
      ...combinedState(resultFolder, resultParents, resultAccess, resultUserDisplay, needsUserData),
      refetch: async () => {
        return Promise.all([resultFolder.refetch(), resultParents.refetch(), resultAccess.refetch()]);
      },
      data: newData,
    };
  }
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
      invalidateQuotaUsage(dispatch);
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
    invalidateQuotaUsage(dispatch);
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

  const createFolderAppPlatform = async (
    payload: NewFolder & {
      /**
       * UIDs of teams to add as owner references to the new folder
       */
      teamOwnerReferences?: Array<{ uid: string; name: string }>;
    }
  ) => {
    const { teamOwnerReferences: teamOwnerReferenceUids, ...folder } = payload;

    /**
     * Additional metadata to use for the folder
     *
     * If team details are included, add them as owner references to the folder
     */
    const partialMetadata: ObjectMeta =
      teamOwnerReferenceUids && teamOwnerReferenceUids.length > 0
        ? {
            ownerReferences: [
              ...teamOwnerReferenceUids.map(({ uid, name }) => ({
                apiVersion: `${IAM_API_GROUP}/${IAM_API_VERSION}`,
                kind: 'Team',
                name,
                uid,
                controller: true,
                blockOwnerDeletion: false,
              })),
            ],
          }
        : {};

    const apiPayload: CreateFolderApiArg = {
      folder: {
        spec: {
          title: folder.title,
        },
        metadata: {
          ...partialMetadata,
          generateName: 'f',
          annotations: {
            ...(folder.parentUid && { [AnnoKeyFolder]: folder.parentUid }),
          },
        },
      },
    };

    const result = await createFolder(apiPayload);
    if (!result.error) {
      refresh({ childrenOf: folder.parentUid });
      deletedDashboardsCache.clear();
      invalidateQuotaUsage(dispatch);
    }

    return {
      ...result,
      data: result.data ? appPlatformFolderToLegacyFolder(result.data) : undefined,
    };
  };

  return [createFolderAppPlatform, result] as const;
}

export function useUpdateFolder() {
  const [updateFolder, result] = useUpdateFolderMutation();
  const legacyHook = useLegacySaveFolderMutation();
  const refresh = useRefreshFolders();

  if (!config.featureToggles.foldersAppPlatformAPI) {
    return legacyHook;
  }

  const updateFolderAppPlatform = async (folder: Pick<FolderDTO, 'uid' | 'title' | 'version' | 'parentUid'>) => {
    const payload: UpdateFolderApiArg = {
      name: folder.uid,
      patch: {
        spec: { title: folder.title },
        metadata: {
          name: folder.uid,
          annotations: {
            ...(folder.parentUid && { [AnnoKeyFolder]: folder.parentUid }),
          },
        },
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
  resultAccess: ReturnType<typeof useGetFolderAccessQuery>,
  resultUserDisplay: ReturnType<typeof useLazyGetDisplayMappingQuery>[1],
  needsUserData: boolean
) {
  const results = needsUserData
    ? [result, resultParents, resultAccess, resultUserDisplay]
    : [result, resultParents, resultAccess];
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
    // the root folder has no url — the backend leaves it blank
    url: isRootFolderUID(name) ? '' : getFolderUrl(name, title),
    created: creationTimestamp || '0001-01-01T00:00:00Z',
    updated: annotations?.[AnnoKeyUpdatedTimestamp] || '0001-01-01T00:00:00Z',
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    managedBy: annotations?.[AnnoKeyManagerKind] as ManagerKind,
    parentUid: annotations?.[AnnoKeyFolder],
    version: generation || 1,
    hasAcl: false,
  };
};
