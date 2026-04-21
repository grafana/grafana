import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { type EvaluationChain, EvaluationScenario, type RecordingRuleReference } from '../types/evaluation-chain';
import { type RuleFormValues } from '../types/rule-form';

import { useEvaluationChains } from './useEvaluationChains';
import { useRecordingRulesByMetric } from './useRecordingRulesByMetric';

export interface RecordingRuleDetectionResult {
  scenario: EvaluationScenario;
  referencedRecordingRules: RecordingRuleReference[];
  chains: EvaluationChain[];
  recommendedChainUid?: string;
  warnings: string[];
  isLoading: boolean;
}

export function useDetectRecordingRuleReferences(): RecordingRuleDetectionResult {
  const { watch } = useFormContext<RuleFormValues>();
  const queries = watch('queries');

  const { byDatasourceAndMetric, isLoading: loadingRecordingRules } = useRecordingRulesByMetric();
  const { getChainsForRuleUid, isLoading: loadingChains } = useEvaluationChains();

  return useMemo(() => {
    const isLoading = loadingRecordingRules || loadingChains;

    if (isLoading || !queries?.length) {
      return {
        scenario: EvaluationScenario.NoRecordingRules,
        referencedRecordingRules: [],
        chains: [],
        warnings: [],
        isLoading,
      };
    }

    // Step 1: Find data queries (non-expression queries) by checking datasourceUid
    // Expression queries have a special datasource uid like "__expr__"
    const dataQueries = queries.filter((q: AlertQuery) => {
      const uid = q.datasourceUid;
      return uid !== '__expr__' && uid !== '-100';
    });

    // Step 2: Match against known recording rules by datasource + metric
    const matchedRules: RecordingRuleReference[] = [];
    for (const query of dataQueries) {
      const metric = extractMetricFromQuery(query);
      if (!metric) {
        continue;
      }
      const key = `${query.datasourceUid}::${metric}`;
      const recordingRule = byDatasourceAndMetric.get(key);
      if (recordingRule) {
        // Resolve chain membership
        const chains = getChainsForRuleUid(recordingRule.uid);
        matchedRules.push({
          ...recordingRule,
          chainUid: chains[0]?.uid,
          chainName: chains[0]?.name,
        });
      }
    }

    // Step 3: Classify scenario
    if (matchedRules.length === 0) {
      return {
        scenario: EvaluationScenario.NoRecordingRules,
        referencedRecordingRules: [],
        chains: [],
        warnings: [],
        isLoading: false,
      };
    }

    const uniqueChainUids = new Set(matchedRules.map((r) => r.chainUid).filter(Boolean));
    const unchainedRules = matchedRules.filter((r) => !r.chainUid);
    const allChains: EvaluationChain[] = [...uniqueChainUids]
      .map((uid): EvaluationChain | undefined => {
        const rule = matchedRules.find((r) => r.chainUid === uid);
        return rule && uid
          ? {
              uid,
              name: rule.chainName ?? '',
              interval: '',
              intervalSeconds: 0,
              recordingRuleRefs: [],
              alertRuleRefs: [],
            }
          : undefined;
      })
      .filter((chain): chain is EvaluationChain => chain !== undefined);

    // All referenced rules are unchained
    if (uniqueChainUids.size === 0) {
      return {
        scenario: EvaluationScenario.UnchainedRecordingRules,
        referencedRecordingRules: matchedRules,
        chains: [],
        warnings: [],
        isLoading: false,
      };
    }

    // All referenced rules belong to the same chain (some may be unchained too)
    if (uniqueChainUids.size === 1 && unchainedRules.length === 0) {
      const chainUid = [...uniqueChainUids][0]!;
      return {
        scenario: EvaluationScenario.SingleChain,
        referencedRecordingRules: matchedRules,
        chains: allChains,
        recommendedChainUid: chainUid,
        warnings: [],
        isLoading: false,
      };
    }

    // Multiple chains or mix of chained + unchained
    return {
      scenario: EvaluationScenario.MultipleChains,
      referencedRecordingRules: matchedRules,
      chains: allChains,
      warnings: [
        'This alert rule queries recording rules from different evaluation chains. Sequential execution cannot be guaranteed.',
      ],
      isLoading: false,
    };
  }, [queries, byDatasourceAndMetric, getChainsForRuleUid, loadingRecordingRules, loadingChains]);
}

/**
 * Extract metric name from a data query model.
 * This is a heuristic — different data sources store the metric differently.
 */
function extractMetricFromQuery(query: AlertQuery): string | undefined {
  // query.model is a loose data-source-specific shape; access fields dynamically.
  const expr: unknown = Reflect.get(query.model, 'expr');
  // Prometheus-style: expr field contains the metric or PromQL
  if (typeof expr === 'string') {
    // Simple metric reference (no operators/functions) — most recording rule queries
    const trimmed = expr.trim();
    if (/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(trimmed)) {
      return trimmed;
    }
  }
  // Grafana recording rule metric field
  const metric: unknown = Reflect.get(query.model, 'metric');
  if (typeof metric === 'string') {
    return metric;
  }
  return undefined;
}
