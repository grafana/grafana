import { HttpResponse, http } from 'msw';

import { API_GROUP, API_VERSION, type RuleSequence } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

export const RULE_SEQUENCE_SEARCH_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/rulesequences/search`;

interface RuleSequenceSearchBody {
  where?: { filter?: { field: string; operator: string; values: string[] } };
}

/** Answers the rule sequence search from `sequences` the way the search index does. */
export const getRuleSequenceSearchHandler = (
  sequences: RuleSequence[] = [],
  onRequest?: (body: RuleSequenceSearchBody) => void
) =>
  http.post(RULE_SEQUENCE_SEARCH_URL, async ({ request }) => {
    const body = (await request.json()) as RuleSequenceSearchBody;
    onRequest?.(body);
    const filter = body.where?.filter;
    const items = sequences
      .map((sequence) => ({
        name: sequence.metadata.name ?? '',
        recordingRuleUIDs: sequence.spec.recordingRules.map((ref) => ref.name),
        alertRuleUIDs: (sequence.spec.alertingRules ?? []).map((ref) => ref.name),
        interval: sequence.spec.trigger.interval,
      }))
      .filter((hit) => {
        if (!filter) {
          return true;
        }
        const members = filter.field === 'alertRuleUIDs' ? hit.alertRuleUIDs : hit.recordingRuleUIDs;
        return members.some((uid) => filter.values.includes(uid));
      })
      .map(({ name, ...fields }) => ({
        resource: { group: API_GROUP, kind: 'RuleSequence', name },
        // The index leaves out a field with no values.
        fields: Object.fromEntries(
          Object.entries(fields).filter(([, value]) => !Array.isArray(value) || value.length > 0)
        ),
      }));
    return HttpResponse.json({ metadata: { totalHits: items.length, totalHitsRelation: 'eq' }, items });
  });

const handlers = [getRuleSequenceSearchHandler()];
export default handlers;
