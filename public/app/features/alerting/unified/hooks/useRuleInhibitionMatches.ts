import { matchLabelsSet } from '@grafana/alerting/unstable';
import { InhibitionRule, generatedAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { Labels } from '@grafana/data';

import { objectLabelsToArray } from '../utils/labels';

type InhibitionRole = 'source' | 'target' | 'both';

export interface InhibitionMatch {
  rule: InhibitionRule;
  role: InhibitionRole;
}

export function useRuleInhibitionMatches(labels: Labels): {
  matches: InhibitionMatch[];
  isLoading: boolean;
} {
  const { data, isLoading } = generatedAPI.useListInhibitionRuleQuery({});

  if (isLoading || !data?.items?.length) {
    return { matches: [], isLoading };
  }

  const ruleLabels = objectLabelsToArray(labels);

  const matches: InhibitionMatch[] = [];
  for (const inhibitionRule of data.items) {
    const { spec } = inhibitionRule;
    const isTarget = spec.target_matchers?.length ? matchLabelsSet(spec.target_matchers, ruleLabels) : false;
    const isSource = spec.source_matchers?.length ? matchLabelsSet(spec.source_matchers, ruleLabels) : false;

    if (isTarget || isSource) {
      let role: InhibitionRole;
      if (isTarget && isSource) {
        role = 'both';
      } else if (isTarget) {
        role = 'target';
      } else {
        role = 'source';
      }

      matches.push({ rule: inhibitionRule, role });
    }
  }

  return { matches, isLoading: false };
}
