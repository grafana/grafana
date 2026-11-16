import { useMemo } from 'react';
import * as z from 'zod/mini';

import {
  type ListRuleSequenceSearchV0Alpha1ApiArg,
  type ListRuleSequenceSearchV0Alpha1ApiResponse,
  generatedAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type RuleKind } from '../shared/ruleKind';

export interface RuleSequenceMembership {
  name: string;
  /** The sequence's evaluation interval, which overrides the rule's own. */
  interval?: string;
}

// The generated search types `fields` as an untyped map, so the hit is still parsed here.
const ruleSequenceHitSchema = z.object({
  resource: z.object({ name: z.string() }),
  fields: z.optional(
    z.object({
      recordingRuleUIDs: z.optional(z.array(z.string())),
      alertRuleUIDs: z.optional(z.array(z.string())),
      interval: z.optional(z.string()),
    })
  ),
});

const ruleSequenceSearchResponseSchema = z.object({ items: z.array(ruleSequenceHitSchema) });

type RuleSequenceHit = z.infer<typeof ruleSequenceHitSchema>;

/**
 * The sequence of one rule, `null` when it is in none and absent when the lookup failed. Each rule has its own
 * cache entry, which the page search usually fills for the whole page.
 */
export function useRuleSequenceMembership(kind: RuleKind, uid: string) {
  const { currentData, isLoading, isError } = generatedAPI.useListRuleSequenceSearchV0Alpha1Query(
    membershipSearchArg(kind, [uid])
  );
  const sequence = useMemo((): RuleSequenceMembership | null | undefined => {
    // A failed refetch keeps the earlier answer in currentData, which may be outdated.
    if (isError) {
      return undefined;
    }
    const parsed = ruleSequenceSearchResponseSchema.safeParse(currentData);
    if (!parsed.success) {
      return undefined;
    }
    const hit = parsed.data.items.find((candidate) => hitContains(candidate, kind, uid));
    return hit ? { name: hit.resource.name, interval: hit.fields?.interval } : null;
  }, [currentData, isError, kind, uid]);
  return { sequence, isLoading, isError };
}

/** The page sends it for all its rules, each row for its own. */
export function membershipSearchArg(kind: RuleKind, uids: string[]): ListRuleSequenceSearchV0Alpha1ApiArg {
  return {
    searchQuery: {
      // search.grafana.app has no other version; the backend rejects any other.
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: {
        filter: { field: kind === 'alert' ? 'alertRuleUIDs' : 'recordingRuleUIDs', operator: 'In', values: uids },
      },
      fields: ['recordingRuleUIDs', 'alertRuleUIDs', 'interval'],
      // A rule belongs to at most one sequence, so there are never more hits than rules.
      limit: uids.length,
    },
  };
}

/**
 * Splits the page's sequence search into the answer each rule's own one-rule search would get, ready for
 * `upsertQueryEntries`. A failed or malformed search gives no entries, so the rows fetch their own.
 */
export function toMembershipEntries(
  kind: RuleKind,
  uids: string[],
  response: ListRuleSequenceSearchV0Alpha1ApiResponse | undefined
) {
  const parsed = ruleSequenceSearchResponseSchema.safeParse(response);
  if (!parsed.success || !response) {
    return [];
  }
  const hits = parsed.data.items;
  return uids.map((uid) => {
    // The parsed hits keep the order of the raw items, so the index picks the raw item of a matching hit.
    const items = response.items.filter((_item, index) => hitContains(hits[index], kind, uid));
    return {
      endpointName: 'listRuleSequenceSearchV0Alpha1' as const,
      arg: membershipSearchArg(kind, [uid]),
      value: { items, metadata: { totalHits: items.length, totalHitsRelation: 'eq' } },
    };
  });
}

function hitContains(hit: RuleSequenceHit, kind: RuleKind, uid: string): boolean {
  const members = kind === 'alert' ? hit.fields?.alertRuleUIDs : hit.fields?.recordingRuleUIDs;
  return members?.includes(uid) ?? false;
}
