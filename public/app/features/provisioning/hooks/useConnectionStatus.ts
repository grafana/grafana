import { skipToken } from '@reduxjs/toolkit/query';

import { useListConnectionQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isConnectionPending } from '../utils/connectionStatus';

export function useConnectionStatus(name: string | undefined) {
  const query = useListConnectionQuery(
    name
      ? {
          fieldSelector: `metadata.name=${name}`,
          watch: true,
        }
      : skipToken
  );

  const connection = query.data?.items?.[0];
  const readyCondition = connection?.status?.conditions?.find((c) => c.type === 'Ready');

  const isPending = isConnectionPending(connection?.status);
  const isConnected = readyCondition?.status === 'True';
  const isDisconnected = readyCondition?.status === 'False' && !isPending;

  return {
    connection,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isConnected,
    isDisconnected,
    isPending,
    disconnectReason: isDisconnected ? readyCondition?.reason : undefined,
    disconnectMessage: isDisconnected ? readyCondition?.message : undefined,
    health: connection?.status?.health,
  };
}
