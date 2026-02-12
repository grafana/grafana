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
      // API expects base64-encoded private key
      const secure: ConnectionSecure | undefined = privateKey?.length
        ? { privateKey: { create: btoa(privateKey) } }
        : undefined;

      const connection: Connection = {
        metadata: name ? { name } : { generateName: 'c' },
        spec: data,
        secure,
      };

      // First validate with dryRun - unwrap will throw on validation errors
      if (name) {
        await update({ name, connection, dryRun: 'All' }).unwrap();
      } else {
        await create({ connection, dryRun: 'All' }).unwrap();
      }

      // If validation passes, proceed with actual create/update
      if (name) {
        return update({ name, connection });
      }

      return create({ connection });
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
}
