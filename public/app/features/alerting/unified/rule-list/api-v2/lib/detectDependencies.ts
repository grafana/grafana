import { type RuleGroup } from 'app/types/unified-alerting';

import { prometheusRuleType } from '../../../utils/rules';

import { type ChainInfo } from './types';

// NOTE: string-match heuristic. Can produce false positives when a recording-metric
// name collides with a label value or free text. Follow-up: PromQL AST parse via
// @grafana/prometheus. Deferred for PoC.
export function detectDependencies(group: RuleGroup): ChainInfo {
  const recordings = group.rules.filter(prometheusRuleType.recordingRule);
  const alerts = group.rules.filter(prometheusRuleType.alertingRule);

  if (recordings.length === 0 || alerts.length === 0) {
    return { isChain: false, dependencies: new Map() };
  }

  const recordingNames = recordings.map((r) => r.name).filter(Boolean);
  const dependencies = new Map<string, string[]>();

  for (const alert of alerts) {
    const matches: string[] = [];
    for (const name of recordingNames) {
      if (!name) {
        continue;
      }
      const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
      if (pattern.test(alert.query)) {
        matches.push(name);
      }
    }
    if (matches.length > 0) {
      dependencies.set(alert.name, matches);
    }
  }

  return { isChain: dependencies.size > 0, dependencies };
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
