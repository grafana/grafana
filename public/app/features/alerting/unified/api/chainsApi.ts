// TODO: The evaluation-chain backend endpoints do not exist yet. Once they ship,
// replace the fixture-backed queryFn below with a real `query: ...` URL.
// Tracked under the `alerting.rulesAPIV2` feature toggle rollout.

import { alertingApi } from './alertingApi';

export type ChainRuleType = 'alert' | 'recording';
export type ChainRuleState = 'firing' | 'normal' | 'pending' | 'recovering' | 'recording';
export type ChainMode = 'Sequential' | 'Parallel' | 'Conditional';

export interface ChainMembership {
  id: string;
  position: number;
  total: number;
}

export interface ChainStep {
  type: ChainRuleType;
  state: ChainRuleState;
  name: string;
  sub?: string;
}

export interface Chain {
  id: string;
  mode: ChainMode;
  interval: string;
  steps: ChainStep[];
}

export const chainsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getChain: build.query<Chain, { chainId: string }>({
      keepUnusedDataFor: 300,
      queryFn: async ({ chainId }) => {
        const { chainFixtures } = await import('../mocks/fixtures/chains');
        const chain = chainFixtures[chainId];
        if (!chain) {
          return { error: { status: 404, data: `Chain ${chainId} not found` } };
        }
        return { data: chain };
      },
    }),
  }),
});

export const { useGetChainQuery } = chainsApi;
