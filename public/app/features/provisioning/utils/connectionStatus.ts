import { type ConnectionStatus } from 'app/api/clients/provisioning/v0alpha1';

/**
 * Checks if a connection is ready by verifying that the Ready condition exists and has status 'True'.
 * @param status - The connection status to check
 * @returns true if the connection has a Ready condition with status 'True', false otherwise
 */
export function isConnectionReady(status: ConnectionStatus | undefined): boolean {
  return status?.conditions?.find((c) => c.type === 'Ready')?.status === 'True';
}

export function isConnectionPending(status: ConnectionStatus | undefined): boolean {
  const readyCondition = status?.conditions?.find((c) => c.type === 'Ready');
  if (!readyCondition) {
    return true;
  }
  // Routine token refreshes bump token.lastUpdated without an immediate health
  // re-check; a newer token only means authorization is in flight while the
  // connection is not Ready yet (right after /authorize writes the token).
  return readyCondition.status !== 'True' && (status?.token?.lastUpdated ?? 0) > (status?.health?.checked ?? 0);
}
