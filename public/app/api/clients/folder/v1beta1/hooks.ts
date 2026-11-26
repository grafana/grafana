import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { invalidateQuotaUsage } from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents } from '@grafana/runtime';
import {
  API_GROUP as IAM_API_GROUP,
  API_VERSION as IAM_API_VERSION,
  type DisplayList,
  iamAPIv0alpha1,
  useGetDisplayMappingQuery,
} from 'app/api/clients/iam/v0alpha1';
import { useAppNotification } from 'app/core/copy/appNotification';
import { type DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { getSelectedUIDs } from 'app/features/browse-dashboards/utils/dashboards';
import { invalidateStarredSearchFor } from 'app/features/stars/api';
import { type FolderDTO, type NewFolder } from 'app/types/folders';
import { dispatch } from 'app/types/store';

import kbn from '../../../../core/utils/kbn';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyGrantPermissions,
  AnnoKeyManagerIdentity,
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
import { getVirtualFolder } from './virtualFolders';

import {
  folderAPIv1beta1,
  useGetFolderQuery,
  useGetFolderAccessQuery,
  useGetFolderParentsQuery,
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

interface MoveFoldersArgs {
  destinationUID: string;
  folderUIDs: string[];
}

interface MoveFolderArgs {
  folderUID: string;
  destinationUID: string;
}

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

export async function getCombinedFolder(uid: string) {
  // Virtual folders aren't real resources, so the folder object comes from a
  // hardcoded constant and they have no parents. Access is still a real query —
  // the backend returns proper access info for the root and "shared with me" folders.
  const virtualFolder = getVirtualFolder(uid);
  if (virtualFolder) {
    const accessResponse = await dispatch(folderAPIv1beta1.endpoints.getFolderAccess.initiate({ name: uid }));
    if (!accessResponse?.data) {
      throw accessResponse.error || new Error('Folder access response is undefined');
    }
    return combineFolderResponses(virtualFolder, accessResponse.data, []);
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

// One reference across renders, so a virtual folder's empty parents don't recompute the stitched folder
const NO_PARENTS: FolderInfo[] = [];

/**
 * Reads a folder through the app platform API in the shape of a legacy FolderDTO. The folder, its access info and its
 * parents are separate resources, so the three queries are stitched together.
 *
 * Like a single query, `data` stays the previous folder while another one loads, but not once that load has failed.
 * It is always one whole folder: the parts of two folders are never mixed.
 * @param uid
 */
export function useGetCombinedFolderQuery(uid?: string) {
  const virtualFolder = getVirtualFolder(uid);
  const params = !uid ? skipToken : { name: uid };
  // A virtual folder is a hardcoded object with no parents, so only its access is fetched: the backend
  // returns proper access info for the root and "shared with me" folders.
  const storedFolderParams = virtualFolder ? skipToken : params;

  const resultFolder = useGetFolderQuery(storedFolderParams);
  const resultAccess = useGetFolderAccessQuery(params);
  const resultParents = useGetFolderParentsQuery(storedFolderParams);
  // currentData, not data: each query keeps the previous uid's data until its own result lands, and they land at
  // different times, so data would pair one folder with another folder's access.
  const userKeys = getUserKeys(resultFolder.currentData);
  const resultUserDisplay = useGetDisplayMappingQuery(userKeys.length ? { key: userKeys } : skipToken);

  // User names only fill in createdBy and updatedBy. If they can't be looked up, for example on a 403 from the
  // display API, return the folder without them and keep that error off the folder: the folder picker reads a
  // 403 as no access to the folder and disables itself.
  const waitForUserData = userKeys.length > 0 && !resultUserDisplay.isError;

  const folderQueries = virtualFolder ? [resultAccess] : [resultFolder, resultParents, resultAccess];
  const results = waitForUserData ? [...folderQueries, resultUserDisplay] : folderQueries;
  const isFetching = results.some((r) => r.isFetching);

  const folder = virtualFolder ?? resultFolder.currentData;
  const parents = virtualFolder ? NO_PARENTS : resultParents.currentData?.items;
  const access = resultAccess.currentData;
  const userDisplay = resultUserDisplay.currentData;
  const current = useMemo(
    () =>
      folder && access && parents && (!waitForUserData || userDisplay)
        ? combineFolderResponses(folder, access, parents, userDisplay)
        : undefined,
    [folder, access, parents, userDisplay, waitForUserData]
  );

  // While another folder loads, keep returning the last whole one, as a single query keeps its previous data.
  // Callers render "no folder" as the root or as a missing folder.
  const [shown, setShown] = useState(current);
  const data = current ?? (isFetching ? shown : undefined);
  if (data !== shown) {
    setShown(data);
  }

  // One FolderDTO and one request state, so on the outside this behaves as a single query
  return {
    // Not the parts' own isLoading: a part that still holds another folder's data reports that it is not loading
    isLoading: !data && isFetching,
    isFetching,
    isSuccess: results.every((r) => r.isSuccess),
    isError: results.some((r) => r.isError),
    // Only one error will be shown. TODO: somehow create a single error out of them?
    error: results.find((r) => r.error)?.error,
    data,
  };
}

export function useMoveFolders() {
  const [updateFolder, updateFolderData] = useUpdateFolderMutation();
  const dispatch = useDispatch();
  const refetch = useRefreshFolders();

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
  const [createFolderMutation, result] = useCreateFolderMutation();
  const refresh = useRefreshFolders();

  const createFolder = async (
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
          annotations:
            folder.parentUid && !isRootFolderUID(folder.parentUid)
              ? { [AnnoKeyFolder]: folder.parentUid }
              : { [AnnoKeyGrantPermissions]: 'default' },
        },
      },
    };

    const result = await createFolderMutation(apiPayload);
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

  return [createFolder, result] as const;
}

export function useUpdateFolder() {
  const [updateFolderMutation, result] = useUpdateFolderMutation();
  const refresh = useRefreshFolders();

  const updateFolder = async (folder: Pick<FolderDTO, 'uid' | 'title' | 'version' | 'parentUid'>) => {
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

    const result = await updateFolderMutation(payload);
    refresh({ childrenOf: folder.parentUid });
    // A rename changes a starred row's label without changing the star set
    if (!result.error) {
      dispatch(invalidateStarredSearchFor([folder.uid]));
    }

    return {
      ...result,
      data: result.data ? appPlatformFolderToLegacyFolder(result.data) : undefined,
    };
  };

  return [updateFolder, result] as const;
}

export function useMoveFolder() {
  const [updateFolder, updateFolderData] = useUpdateFolderMutation();
  const refresh = useRefreshFolders();
  const notify = useAppNotification();

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
      dispatch(refreshParents({ kind: 'folder', uids: options.parentsOf }));
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

export function useGetAffectedItems(selectedItems: Pick<DashboardTreeSelection, 'folder' | 'dashboard'>) {
  const folderUIDs = getSelectedUIDs(selectedItems, 'folder');
  const dashboardUIDs = getSelectedUIDs(selectedItems, 'dashboard');

  return useGetAffectedItemsQuery({ folderUIDs, dashboardUIDs });
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
    managerId: annotations?.[AnnoKeyManagerIdentity],
    parentUid: annotations?.[AnnoKeyFolder],
    version: generation || 1,
    hasAcl: false,
  };
};
