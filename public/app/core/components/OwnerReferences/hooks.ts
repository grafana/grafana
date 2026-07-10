import { useUpdateFolderMutation, useGetFolderQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type OwnerReference } from 'app/api/clients/folder/v1beta1';

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
 * Set the owner references of a resource to the given list.
 *
 * A folder can be owned by multiple teams, so the full desired set is written in a single
 * patch. Passing an empty list removes all owner references.
 *
 * Only folders are supported at this time
 */
export const useSetOwnerReferences = ({ resourceId }: { resourceId: string }) => {
  const [updateFolder, result] = useUpdateFolderMutation();
  return [
    (ownerReferences: OwnerReference[]) =>
      updateFolder({
        name: resourceId,
        patch:
          ownerReferences.length > 0
            ? [
                {
                  op: 'replace',
                  path: '/metadata/ownerReferences',
                  value: ownerReferences,
                },
              ]
            : [
                {
                  op: 'remove',
                  path: '/metadata/ownerReferences',
                },
              ],
      }),
    result,
  ] as const;
};
