export type PersonalAccessTokenScopes = Record<string, string[]>;

export interface PersonalAccessToken {
  uid: string;
  name: string;
  hint: string;
  scopes: PersonalAccessTokenScopes;
  createdAt: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface CreatePersonalAccessTokenRequest {
  name: string;
  scopes: PersonalAccessTokenScopes;
  lifetimeDays: number;
}

export interface CreatePersonalAccessTokenResponse extends PersonalAccessToken {
  token: string;
}

export interface PersonalAccessTokenPolicy {
  enabled: boolean;
  managedByConfig: boolean;
}

export interface UpdatePersonalAccessTokenPolicyRequest {
  enabled: boolean;
  revokeExisting: boolean;
}

export interface UpdatePersonalAccessTokenPolicyResponse extends PersonalAccessTokenPolicy {
  revoked: number;
}

export interface AdminPersonalAccessToken extends PersonalAccessToken {
  userId: number;
  ownerLogin: string;
  ownerEmail: string;
  ownerName: string;
  orgId: number;
  orgName: string;
  createdIp: string;
  lastUsedIp: string;
  lastUsedUserAgent: string;
  revokedReason: string;
}

export type PersonalAccessTokenStatus = 'active' | 'expired' | 'revoked';

export interface SearchPersonalAccessTokensParams {
  query?: string;
  status?: PersonalAccessTokenStatus;
  expiringBefore?: string;
  allOrgs?: boolean;
  sort?: 'name' | 'owner' | 'org' | 'created' | 'expires' | 'lastUsed' | 'status' | 'scopes';
  order?: 'asc' | 'desc';
  page: number;
  perPage: number;
}

export interface SearchPersonalAccessTokensResponse {
  tokens: AdminPersonalAccessToken[];
  totalCount: number;
  page: number;
  perPage: number;
}
