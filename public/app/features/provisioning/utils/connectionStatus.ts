import { ConnectionStatus } from 'app/api/clients/provisioning/v0alpha1';

/**
 * Checks if a connection is ready by verifying that the Ready condition exists and has status 'True'.
 * @param status - The connection status to check
 * @returns true if the connection has a Ready condition with status 'True', false otherwise
 */
export function isConnectionReady(status: ConnectionStatus | undefined): boolean {
  return status?.conditions?.find((c) => c.type === 'Ready')?.status === 'True';
}
