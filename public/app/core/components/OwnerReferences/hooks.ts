import { useState, useEffect } from 'react';

import { useReplaceFolderMutation } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { folderAPIv1beta1, OwnerReference } from 'app/api/clients/folder/v1beta1';
import { useDispatch } from 'app/types/store';

const getReferencesEndpointMap = {
  Folder: (resourceId: string) => folderAPIv1beta1.endpoints.getFolder.initiate({ name: resourceId }),
} as const;

export type SupportedResource = keyof typeof getReferencesEndpointMap;

export const useGetOwnerReferences = ({
  resource,
  resourceId,
}: {
  resource: SupportedResource;
  resourceId: string;
}) => {
  const [ownerReferences, setOwnerReferences] = useState<OwnerReference[]>([]);
  const dispatch = useDispatch();
  const endpointAction = getReferencesEndpointMap[resource];

  useEffect(() => {
    dispatch(endpointAction(resourceId)).then(({ data }) => {
      if (data?.metadata?.ownerReferences) {
        setOwnerReferences(data.metadata.ownerReferences);
      }
    });
  }, [dispatch, endpointAction, resourceId]);

  return ownerReferences;
};

export const useAddOwnerReference = ({ resource, resourceId }: { resource: SupportedResource; resourceId: string }) => {
  const [replaceFolder, result] = useReplaceFolderMutation();
  return [
    (ownerReference: OwnerReference) =>
      replaceFolder({
        name: resourceId,

        folder: {
          status: {},
          metadata: {
            name: resourceId,
            ownerReferences: [ownerReference],
          },
          spec: {
            title: resourceId,
          },
        },
      }),
    result,
  ] as const;
};
