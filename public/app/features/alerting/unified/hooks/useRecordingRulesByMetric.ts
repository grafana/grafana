import { useMemo } from 'react';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type RecordingRuleReference } from '../types/evaluation-chain';

interface RecordingRuleIndex {
  /** Map key is `${targetDatasourceUID}::${metric}` */
  byDatasourceAndMetric: Map<string, RecordingRuleReference>;
  isLoading: boolean;
  error: unknown;
}

export function useRecordingRulesByMetric(): RecordingRuleIndex {
  const { data, isLoading, error } = generatedAPI.useListRecordingRuleQuery({});

  const byDatasourceAndMetric = useMemo(() => {
    const map = new Map<string, RecordingRuleReference>();
    if (!data?.items) {
      return map;
    }
    for (const rule of data.items) {
      const key = `${rule.spec.targetDatasourceUID}::${rule.spec.metric}`;
      map.set(key, {
        uid: rule.metadata.name ?? '',
        name: rule.spec.title,
        metric: rule.spec.metric,
        // Chain membership resolved separately — undefined for now
        chainUid: undefined,
        chainName: undefined,
      });
    }
    return map;
  }, [data]);

  return { byDatasourceAndMetric, isLoading, error };
}
