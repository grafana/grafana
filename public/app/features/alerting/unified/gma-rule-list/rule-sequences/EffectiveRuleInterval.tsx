import { RuleInterval } from '../rule-row/RuleInterval';

import { RuleSequencePill } from './RuleSequencePill';
import { type RuleSequenceMembership } from './ruleSequenceMembership';

interface EffectiveRuleIntervalProps {
  /** `null`: not in a sequence. Absent while loading or when the lookup failed. */
  sequence?: RuleSequenceMembership | null;
  ruleInterval?: string;
}

/** Shows nothing while membership is unknown, because the rule's own interval may be wrong then. */
export function EffectiveRuleInterval({ sequence, ruleInterval }: EffectiveRuleIntervalProps) {
  if (sequence === undefined) {
    return null;
  }
  if (sequence === null) {
    return ruleInterval ? <RuleInterval interval={ruleInterval} /> : null;
  }
  return <RuleSequencePill interval={sequence.interval} />;
}
