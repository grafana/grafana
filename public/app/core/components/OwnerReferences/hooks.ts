import { useUpdateFolderMutation, useGetFolderQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type OwnerReference } from 'app/api/clients/folder/v1beta1';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { refetchChildren } from 'app/features/browse-dashboards/state/actions';
import { TEAM_FOLDERS_UID } from 'app/features/search/constants';
import { dispatch } from 'app/store/store';

/**
 * Get the owner references for a resource.
 *
 * Only folders are supported at this time
 */
export const useGetOwnerReferences = ({ resourceId }: { resourceId: string }) => {
  return useGetFolderQuery(
    { name: resourceId },
    { selectFromResult: (result) => ({ ...result, data: result.data?.metadata?.ownerReferences ?? [] }) }
  );
};

/**
 * Set the owner reference of a resource.
 *
 * Only folders are supported at this time
 */
export const useSetOwnerReference = ({ resourceId }: { resourceId: string }) => {
  const [updateFolder, result] = useUpdateFolderMutation();
  return [
    async (ownerReference: OwnerReference) => {
      const folderResult = updateFolder({
        name: resourceId,
        patch: [
          {
            op: 'replace',
            path: '/metadata/ownerReferences',
            value: [ownerReference],
          },
        ],
      });
      await folderResult;
      // This updates browse dashboards page.
      dispatch(refetchChildren({ parentUID: TEAM_FOLDERS_UID, pageSize: PAGE_SIZE }));
      return folderResult;
    },
    result,
  ] as const;
};

/**
 * Remove owner references from a resource.
 *
 * Only folders are supported at this time
 */
export const useRemoveOwnerReferences = ({ resourceId }: { resourceId: string }) => {
  const [updateFolder, result] = useUpdateFolderMutation();
  return [
    async () => {
      const folderResult = updateFolder({
        name: resourceId,
        patch: [
          {
            op: 'remove',
            path: `/metadata/ownerReferences`,
          },
        ],
      });
      await folderResult;
      // This updates browse dashboards page.
      dispatch(refetchChildren({ parentUID: TEAM_FOLDERS_UID, pageSize: PAGE_SIZE }));
      return folderResult;
    },
    result,
  ] as const;
};
