import { useMemo } from 'react';

import {
  useGetRuleSequenceQuery,
  useListAlertRuleQuery,
  useListRecordingRuleQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { stringifyErrorLike } from '../../utils/misc';

import type { RuleSequenceStep, RuleSequenceView } from './types';

export function useRuleSequenceView(sequenceName: string): {
  ruleSequence: RuleSequenceView | undefined;
  isLoading: boolean;
  error: string | undefined;
} {
  const sequenceQuery = useGetRuleSequenceQuery({ name: sequenceName });
  const alertRulesQuery = useListAlertRuleQuery({});
  const recordingRulesQuery = useListRecordingRuleQuery({});

  return useMemo(() => {
    if (sequenceQuery.isLoading || alertRulesQuery.isLoading || recordingRulesQuery.isLoading) {
      return { ruleSequence: undefined, isLoading: true, error: undefined };
    }

    // Collect errors from all queries
    const errors = [sequenceQuery.error, alertRulesQuery.error, recordingRulesQuery.error].filter(Boolean);
    if (errors.length > 0) {
      return { ruleSequence: undefined, isLoading: false, error: stringifyErrorLike(errors[0]) };
    }

    // At this point all data should be available
    if (!sequenceQuery.data) {
      return { ruleSequence: undefined, isLoading: false, error: undefined };
    }

    const sequence = sequenceQuery.data;
    const alertRules = alertRulesQuery.data ?? { items: [] };
    const recordingRules = recordingRulesQuery.data ?? { items: [] };

    // Build lookup maps for alert and recording rules
    const alertRuleMap = new Map<string, string>();
    for (const rule of alertRules.items) {
      const name = rule.metadata.name;
      if (name) {
        alertRuleMap.set(name, rule.spec.title);
      }
    }

    const recordingRuleMap = new Map<string, string>();
    for (const rule of recordingRules.items) {
      const name = rule.metadata.name;
      if (name) {
        recordingRuleMap.set(name, rule.spec.metric);
      }
    }

    // Build the ordered steps from the sequence spec
    const steps: RuleSequenceStep[] = [];

    // Add recording rules first
    for (const ref of sequence.spec.recordingRules ?? []) {
      steps.push({
        type: 'recording',
        name: recordingRuleMap.get(ref.name) ?? ref.name,
        uid: ref.name,
      });
    }

    // Add alerting rules second
    for (const ref of sequence.spec.alertingRules ?? []) {
      steps.push({
        type: 'alert',
        name: alertRuleMap.get(ref.name) ?? ref.name,
        uid: ref.name,
      });
    }

    const ruleSequence: RuleSequenceView = {
      id: sequence.metadata.name ?? '',
      interval: sequence.spec.trigger.interval,
      steps,
    };

    return { ruleSequence, isLoading: false, error: undefined };
  }, [
    sequenceQuery.data,
    sequenceQuery.error,
    sequenceQuery.isLoading,
    alertRulesQuery.data,
    alertRulesQuery.error,
    alertRulesQuery.isLoading,
    recordingRulesQuery.data,
    recordingRulesQuery.error,
    recordingRulesQuery.isLoading,
    // RTK Query stabilizes data/error references when content hasn't changed,
    // so including error objects in deps is safe and doesn't cause spurious re-runs.
  ]);
}
