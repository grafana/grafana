import { type GrafanaPromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

/**
 * The home page loads at most this many Grafana-managed rules. The rules API has no stack-wide
 * aggregate, so above this the numbers cover the first rules only and the page says so.
 */
export const HOME_RULE_LIMIT = 2000;

export interface InstanceCounts {
  firing: number;
  pending: number;
  recovering: number;
  noData: number;
  error: number;
  normal: number;
}

export interface FiringRule {
  uid: string;
  name: string;
  firing: number;
}

export interface GrafanaRulesSummary {
  totalRules: number;
  activeRules: number;
  pausedRules: number;
  failingRules: number;
  instances: InstanceCounts;
  topFiringRules: FiringRule[];
  /** True when the stack has more rules than the page loaded. */
  capped: boolean;
}

const TOP_FIRING_RULES = 5;

export function summarizeGrafanaRules(groups: GrafanaPromRuleGroupDTO[], hasMore: boolean): GrafanaRulesSummary {
  const rules = groups.flatMap((group) => group.rules);
  const instances: InstanceCounts = { firing: 0, pending: 0, recovering: 0, noData: 0, error: 0, normal: 0 };
  const firingRules: FiringRule[] = [];
  let pausedRules = 0;
  let failingRules = 0;

  for (const rule of rules) {
    if (rule.isPaused) {
      pausedRules++;
    }
    if (rule.health === 'error') {
      failingRules++;
    }
    if (rule.type !== PromRuleType.Alerting) {
      continue;
    }

    const totals = rule.totals ?? {};
    instances.firing += totals.alerting ?? 0;
    instances.pending += totals.pending ?? 0;
    instances.recovering += totals.recovering ?? 0;
    instances.noData += totals.nodata ?? 0;
    instances.error += totals.error ?? 0;
    instances.normal += totals.inactive ?? 0;

    if (totals.alerting) {
      firingRules.push({ uid: rule.uid, name: rule.name, firing: totals.alerting });
    }
  }

  const topFiringRules = firingRules.sort((a, b) => b.firing - a.firing).slice(0, TOP_FIRING_RULES);

  return {
    totalRules: rules.length,
    activeRules: rules.length - pausedRules,
    pausedRules,
    failingRules,
    instances,
    topFiringRules,
    capped: hasMore,
  };
}
