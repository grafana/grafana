import { AuthProviderStatus } from 'app/types';

export interface AuthProviderInfo {
  id: string;
  type: string;
  protocol: string;
  displayName: string;
  configPath?: string;
}

export type GetStatusHook = () => Promise<AuthProviderStatus>;
