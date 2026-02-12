import { useUpdateFolderMutation, useGetFolderQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { OwnerReference } from 'app/api/clients/folder/v1beta1';

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
    (ownerReference: OwnerReference) =>
      updateFolder({
        name: resourceId,
        patch: [
          {
            op: 'replace',
            path: '/metadata/ownerReferences',
            value: [ownerReference],
          },
        ],
      }),
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
    () => {
      return updateFolder({
        name: resourceId,
        patch: [
          {
            op: 'remove',
            path: `/metadata/ownerReferences`,
          },
        ],
      });
    },
    result,
  ] as const;
};
