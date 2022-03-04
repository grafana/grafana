import { WithAccessControlMetadata } from '@grafana/data';
import { ApiKey, OrgRole, Role } from '.';

export interface OrgServiceAccount extends WithAccessControlMetadata {
  serviceAccountId: number;
  avatarUrl: string;
  email: string;
  login: string;
  name: string;
  displayName: string;
  orgId: number;
  role: OrgRole;
  tokens: number[];
}

export interface ServiceAccount {
  id: number;
  label: string;
  avatarUrl: string;
  login: string;
  email: string;
  name: string;
  displayName: string;
  orgId?: number;
}

export interface ServiceAccountDTO extends WithAccessControlMetadata {
  id: number;
  orgId: number;
  tokens: number;
  name: string;
  login: string;
  avatarUrl?: string;
  createdAt: string;
  isDisabled: boolean;
  teams: string[];
  role: OrgRole;
}

export interface ServiceAccountProfileState {
  serviceAccount: ServiceAccountDTO;
  isLoading: boolean;
  tokens: ApiKey[];
}

export interface ServiceAccountsState {
  serviceAccounts: ServiceAccountDTO[];
  searchQuery: string;
  searchPage: number;
  isLoading: boolean;
  roleOptions: Role[];
  serviceAccountToRemove: ServiceAccountDTO | null;
  builtInRoles: Record<string, Role[]>;
}
