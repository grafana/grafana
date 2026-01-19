import { useCallback } from 'react';

import {
  Connection,
  ConnectionSecure,
  ConnectionSpec,
  useCreateConnectionMutation,
  useReplaceConnectionMutation,
} from 'app/api/clients/provisioning/v0alpha1';

export function useCreateOrUpdateConnection(name?: string) {
  const [create, createRequest] = useCreateConnectionMutation();
  const [update, updateRequest] = useReplaceConnectionMutation();

  const updateOrCreate = useCallback(
    async (data: ConnectionSpec, privateKey?: string) => {
      const secure: ConnectionSecure | undefined = privateKey?.length
        ? { privateKey: { create: btoa(privateKey) } }
        : undefined;

      const connection: Connection = {
        metadata: name ? { name } : { generateName: 'c' },
        spec: data,
        secure,
      };

      if (name) {
        return update({
          name,
          connection,
        });
      }

      return create({ connection });
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}
