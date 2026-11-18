import { getBackendSrv } from '@grafana/runtime';

import {
  type CreatePersonalAccessTokenRequest,
  type SearchPersonalAccessTokensParams,
  type SearchPersonalAccessTokensResponse,
  type CreatePersonalAccessTokenResponse,
  type PersonalAccessToken,
  type PersonalAccessTokenPolicy,
  type UpdatePersonalAccessTokenPolicyRequest,
  type UpdatePersonalAccessTokenPolicyResponse,
} from './types';

export type PolicyLevel = 'instance' | 'org';

const policyUrl = (level: PolicyLevel) =>
  level === 'instance' ? '/api/admin/settings/personal-access-tokens' : '/api/org/settings/personal-access-tokens';

export const personalAccessTokensApi = {
  list: (): Promise<PersonalAccessToken[]> => getBackendSrv().get('/api/user/tokens'),

  getEffectivePolicy: (): Promise<PersonalAccessTokenPolicy> => getBackendSrv().get('/api/user/tokens-policy'),

  create: (body: CreatePersonalAccessTokenRequest): Promise<CreatePersonalAccessTokenResponse> =>
    getBackendSrv().post('/api/user/tokens', body),

  revoke: (uid: string): Promise<void> => getBackendSrv().delete(`/api/user/tokens/${encodeURIComponent(uid)}`),

  listForUser: (userId: number): Promise<PersonalAccessToken[]> => getBackendSrv().get(`/api/users/${userId}/tokens`),

  revokeForUser: (userId: number, uid: string): Promise<void> =>
    getBackendSrv().delete(`/api/users/${userId}/tokens/${encodeURIComponent(uid)}`),

  search: (p: SearchPersonalAccessTokensParams): Promise<SearchPersonalAccessTokensResponse> =>
    getBackendSrv().get('/api/personal-access-tokens', {
      query: p.query || undefined,
      status: p.status,
      expiringBefore: p.expiringBefore,
      scope: p.allOrgs ? 'all' : undefined,
      sort: p.sort,
      order: p.order,
      page: p.page,
      perpage: p.perPage,
    }),

  revokeByUid: (uid: string, allOrgs: boolean): Promise<void> =>
    getBackendSrv().delete(`/api/personal-access-tokens/${encodeURIComponent(uid)}`, undefined, {
      params: allOrgs ? { scope: 'all' } : undefined,
    }),

  getPolicy: (level: PolicyLevel): Promise<PersonalAccessTokenPolicy> => getBackendSrv().get(policyUrl(level)),

  updatePolicy: (
    level: PolicyLevel,
    body: UpdatePersonalAccessTokenPolicyRequest
  ): Promise<UpdatePersonalAccessTokenPolicyResponse> => getBackendSrv().put(policyUrl(level), body),
};
