import {
  type AlertRule,
  type RecordingRule,
  useGetAlertRuleQuery,
  useGetRecordingRuleQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type RuleResourceState } from './ruleResourceState';

// Editor saves happen outside these queries, so a stale lookup is refetched when the list mounts.
const REFETCH_ON_MOUNT = { refetchOnMountOrArgChange: true } as const;

/** Distinguishes loading from failed; rows never fetch this themselves. */
export function useFullAlertRuleState(uid: string): RuleResourceState<AlertRule> {
  const { data, isError } = useGetAlertRuleQuery({ name: uid }, REFETCH_ON_MOUNT);
  return toResourceState(data, isError);
}

export function useFullRecordingRuleState(uid: string): RuleResourceState<RecordingRule> {
  const { data, isError } = useGetRecordingRuleQuery({ name: uid }, REFETCH_ON_MOUNT);
  return toResourceState(data, isError);
}

function toResourceState<T extends AlertRule | RecordingRule>(data: T | undefined, isError: boolean) {
  // A failed refetch keeps the last loaded rule, so only a lookup that never succeeded reads as failed.
  if (data) {
    return { status: 'loaded', rule: data } as const;
  }
  return { status: isError ? 'error' : 'loading' } as const;
}
