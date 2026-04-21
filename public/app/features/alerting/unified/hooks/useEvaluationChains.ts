import { useMemo } from 'react';

import { type EvaluationChain } from '../types/evaluation-chain';

/**
 * Mock hook for fetching evaluation chains.
 * TODO: Replace with real API call when EvaluationChain K8s kind is available.
 * Use auto-generated client from @grafana/api-clients when ready.
 */
export function useEvaluationChains(): {
  chains: EvaluationChain[];
  isLoading: boolean;
  getChainByUid: (uid: string) => EvaluationChain | undefined;
  getChainsForRuleUid: (ruleUid: string) => EvaluationChain[];
} {
  // Mock: no chains exist until backend API is available
  const chains: EvaluationChain[] = useMemo(() => [], []);

  const getChainByUid = useMemo(() => {
    const map = new Map(chains.map((c) => [c.uid, c]));
    return (uid: string) => map.get(uid);
  }, [chains]);

  const getChainsForRuleUid = useMemo(() => {
    return (ruleUid: string) =>
      chains.filter((c) => c.recordingRuleRefs.includes(ruleUid) || c.alertRuleRefs.includes(ruleUid));
  }, [chains]);

  return { chains, isLoading: false, getChainByUid, getChainsForRuleUid };
}

/**
 * Mock hook for creating an evaluation chain.
 * TODO: Replace with real mutation when EvaluationChain K8s kind is available.
 */
export function useCreateEvaluationChain() {
  const createChain = async (_spec: { name: string; interval: string; recordingRuleRefs: string[] }) => {
    // Mock: return a fake UID. In production, this calls the chain API.
    return { uid: `mock-chain-${Date.now()}` };
  };

  return { createChain, isLoading: false };
}
