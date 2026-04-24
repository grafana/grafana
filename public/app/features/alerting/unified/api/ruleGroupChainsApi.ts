import { type Chain, type ListRuleGroupChainsResponse } from '../rule-list/chainRail/types';

import { alertingApi } from './alertingApi';

interface ListRuleGroupChainsArg {
  folderUid?: string;
}

// Sentinel folder + group used to demo the chain rail before the backend
// endpoint ships. Only the synthetic demo folder section queries for these.
export const DEV_DEMO_CHAIN_FOLDER_UID = 'chain-demo-folder';
export const DEV_DEMO_CHAIN_GROUP_NAME = 'chain-rail-demo';
export const DEV_DEMO_CHAIN_ID = 'dev-chain-demo';

function buildDevChainsFixture(folderUid?: string): Chain[] {
  if (folderUid !== DEV_DEMO_CHAIN_FOLDER_UID) {
    return [];
  }
  return [
    {
      id: DEV_DEMO_CHAIN_ID,
      name: 'Chain rail demo',
      folderUid,
      groupName: DEV_DEMO_CHAIN_GROUP_NAME,
      mode: 'Sequential',
      interval: '1m',
      ruleUids: [],
    },
  ];
}

function isChain(value: unknown): value is Chain {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    'folderUid' in value &&
    'groupName' in value &&
    'ruleUids' in value
  );
}

function parseChainsResponse(raw: unknown): ListRuleGroupChainsResponse {
  if (raw && typeof raw === 'object' && 'chains' in raw && Array.isArray(raw.chains)) {
    return { chains: raw.chains.filter(isChain) };
  }
  return { chains: [] };
}

export const ruleGroupChainsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    listRuleGroupChains: build.query<ListRuleGroupChainsResponse, ListRuleGroupChainsArg>({
      // TODO(alerting.rulesAPIV2): replace queryFn with `query` once the backend chain endpoint ships.
      // The dev branch returns a factory-shaped fixture so the UI can be demoed without a backend.
      async queryFn(arg, _api, _extraOptions, fetchWithBQ) {
        if (process.env.NODE_ENV === 'development') {
          return { data: { chains: buildDevChainsFixture(arg.folderUid) } };
        }
        const result = await fetchWithBQ({
          url: 'api/ruler/grafana/api/v1/chains',
          params: { folder_uid: arg.folderUid },
        });
        if (result.error) {
          return { error: result.error };
        }
        return { data: parseChainsResponse(result.data) };
      },
      providesTags: (_result, _error, { folderUid }) => [{ type: 'RuleGroupChain', id: folderUid ?? '__any__' }],
    }),
  }),
});

export const { useListRuleGroupChainsQuery } = ruleGroupChainsApi;
