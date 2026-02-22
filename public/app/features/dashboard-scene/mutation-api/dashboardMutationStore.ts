import type { MutationClient } from './types';

let _client: MutationClient | null = null;

export function setDashboardMutationClient(client: MutationClient | null): void {
  _client = client;
}

export function getDashboardMutationClient(): MutationClient | null {
  return _client;
}
