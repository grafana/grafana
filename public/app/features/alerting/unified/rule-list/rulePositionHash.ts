/**
 * A branded type representing a rule's position within a group.
 * Format: "<index>:<totalRules>" (e.g., "0:3", "1:5")
 *
 * This is used to disambiguate between identical rules when matching them across
 * different rule sources (e.g., matching Prometheus rules to Ruler API rules).
 * The hash ensures rules are matched by position only when both groups have the
 * same structure (same number of rules).
 *
 * @example
 * // Matching identical rules by position
 * Rule at position 0 in a 2-rule group: "0:2"
 * Rule at position 1 in a 3-rule group: "1:3"
 * // These won't match rules in differently-sized groups even if identical
 */
export type RulePositionHash = `${number}:${number}`;

export function createRulePositionHash(ruleIndex: number, totalRules: number): RulePositionHash {
  return `${ruleIndex}:${totalRules}`;
}
