import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { type RuleSequence, useListRuleSequenceQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import type { GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { shouldUseRulesAPIV2 } from '../../featureToggles';
import { prometheusRuleType } from '../../utils/rules';

import type { RuleSequenceMembership } from './types';

// Memoization cache for sequence membership lookup maps
const cache = new WeakMap<RuleSequence[], Map<string, RuleSequenceMembership>>();

export function buildSequenceMembershipLookup(sequences: RuleSequence[]): Map<string, RuleSequenceMembership> {
  const cached = cache.get(sequences);
  if (cached) {
    return cached;
  }

  const lookup = new Map<string, RuleSequenceMembership>();

  for (const sequence of sequences) {
    const sequenceId = sequence.metadata.name ?? '';
    for (const ref of sequence.spec.recordingRules ?? []) {
      lookup.set(ref.name, { id: sequenceId });
    }
    for (const ref of sequence.spec.alertingRules ?? []) {
      lookup.set(ref.name, { id: sequenceId });
    }
  }

  cache.set(sequences, lookup);
  return lookup;
}

interface UseGrafanaRuleSequenceMembershipOptions {
  rule: GrafanaPromRuleDTO;
  namespaceUid: string;
}

export function useGrafanaRuleSequenceMembership({
  rule,
  namespaceUid,
}: UseGrafanaRuleSequenceMembershipOptions): RuleSequenceMembership | undefined {
  // Scope the request to the rule's folder so the list page only fetches sequences for the
  // folders currently on screen. RTK Query caches per labelSelector, so each folder is fetched
  // once and revisited pages are served from cache.
  const queryArg =
    shouldUseRulesAPIV2() && namespaceUid ? { labelSelector: `${AnnoKeyFolder}=${namespaceUid}` } : skipToken;
  const { data } = useListRuleSequenceQuery(queryArg);

  const ruleUid = prometheusRuleType.grafana.rule(rule) ? rule.uid : undefined;

  return useMemo(() => {
    if (!data?.items || ruleUid === undefined) {
      return undefined;
    }

    const lookup = buildSequenceMembershipLookup(data.items);
    return lookup.get(ruleUid);
  }, [data?.items, ruleUid]);
}
