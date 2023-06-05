import { AuthProviderStatus } from 'app/types';

export interface AuthProviderInfo {
  id: string;
  type: string;
  protocol: string;
  displayName: string;
  configPath?: string;
}

export type GetStatusHook = () => Promise<AuthProviderStatus>;

interface MigrationResult {
  Total: number;
  Migrated: number;
  Failed: number;
  FailedApikeyIDs: number[];
  FailedDetails: string[];
}
