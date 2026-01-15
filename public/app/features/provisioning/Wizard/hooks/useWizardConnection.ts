import { useCallback } from 'react';

import { isFetchError } from '@grafana/runtime';
import {
  Connection,
  ConnectionSecure,
  ConnectionSpec,
  useCreateConnectionMutation,
} from 'app/api/clients/provisioning/v0alpha1';

export function useWizardConnection() {
  const [create, createRequest] = useCreateConnectionMutation();

  const createGitHubAppConnection = useCallback(
    async (appData: { appID: string; installationID: string; privateKey: string }) => {
      const spec: ConnectionSpec = {
        type: 'github',
        github: {
          appID: appData.appID,
          installationID: appData.installationID,
        },
      };

      const secure: ConnectionSecure = {
        privateKey: { create: appData.privateKey },
      };

      const connection: Connection = {
        metadata: { generateName: 'c' },
        spec,
        secure,
      };

      try {
        const result = await create({ connection }).unwrap();
        return {
          success: true,
          connectionName: result.metadata?.name,
          error: null,
        };
      } catch (error) {
        let errorMessage = 'Failed to create connection';
        if (isFetchError(error)) {
          errorMessage = error.data?.message || errorMessage;
        }
        return {
          success: false,
          connectionName: null,
          error: errorMessage,
        };
      }
    },
    [create]
  );

  return {
    createGitHubAppConnection,
    isLoading: createRequest.isLoading,
    error: createRequest.error,
  };
}
