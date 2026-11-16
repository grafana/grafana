/**
 * What share of all rules, as a whole-number percentage, a number of rules is. All rules are the active
 * and the paused ones together. Undefined when there are no rules, so callers never divide by zero.
 */
export function percentOfRules(count: number, active: number, paused: number): number | undefined {
  const total = active + paused;
  return total > 0 ? Math.round((count / total) * 100) : undefined;
}
