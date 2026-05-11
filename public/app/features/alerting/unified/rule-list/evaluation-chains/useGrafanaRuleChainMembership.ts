// Annotation-based demo wiring. Rules opt into the evaluation-chain UI by
// carrying three annotations: id, position, total. This is a temporary
// arrangement so the chip can be exercised end-to-end while the backend
// contract is in flight. Once the backend ships a stable shape for chain
// membership on the rule payload, swap the implementation of
// `extractChainMembership` (or this whole module) and update the constants —
// nothing outside this file needs to change.

import { type Annotations, type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { type ChainMembership } from '../../api/chainsApi';
import { shouldUseRulesAPIV2 } from '../../featureToggles';
import { prometheusRuleType } from '../../utils/rules';

const CHAIN_ID_ANNOTATION = 'grafana.com/chain-id';
const CHAIN_POSITION_ANNOTATION = 'grafana.com/chain-position';
const CHAIN_TOTAL_ANNOTATION = 'grafana.com/chain-total';

export function useGrafanaRuleChainMembership(rule: GrafanaPromRuleDTO): ChainMembership | undefined {
  if (!shouldUseRulesAPIV2()) {
    return undefined;
  }
  if (!prometheusRuleType.grafana.alertingRule(rule)) {
    return undefined;
  }
  return extractChainMembership(rule.annotations);
}

export function extractChainMembership(annotations: Annotations | undefined): ChainMembership | undefined {
  if (!annotations) {
    return undefined;
  }
  const id = annotations[CHAIN_ID_ANNOTATION];
  const position = parsePositiveInteger(annotations[CHAIN_POSITION_ANNOTATION]);
  const total = parsePositiveInteger(annotations[CHAIN_TOTAL_ANNOTATION]);
  if (!id || position === undefined || total === undefined) {
    return undefined;
  }
  return { id, position, total };
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
