import {
  PromRuleDTO,
  PromRuleGroupDTO,
  RulerCloudRuleDTO,
  RulerRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { getPromRuleFingerprint, getRulerRuleFingerprint } from '../utils/rule-id';
import { getRuleName } from '../utils/rules';

import { PromRuleWithOrigin } from './hooks/useFilteredRulesIterator';
import { RulePositionHash, createRulePositionHash } from './rulePositionHash';

export function getMatchingRulerRule(
  rulerRuleGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>,
  promRuleWithOrigin: PromRuleWithOrigin
) {
  const { rule, rulePositionHash } = promRuleWithOrigin;

  // If all rule names are unique, we can use the rule name to find the rule. We don't need to hash the rule
  const rulesByName = rulerRuleGroup.rules.filter((r) => getRuleName(r) === rule.name);
  if (rulesByName.length === 1) {
    return rulesByName[0];
  }

  // If we don't have a unique rule name, try to compare by labels and annotations
  const rulesByLabelsAndAnnotations = rulesByName.filter((r) => {
    return getRulerRuleFingerprint(r, false).join('-') === getPromRuleFingerprint(rule, false).join('-');
  });

  if (rulesByLabelsAndAnnotations.length === 1) {
    return rulesByLabelsAndAnnotations[0];
  }

  // As a last resort, compare including the query
  const rulesByLabelsAndAnnotationsAndQuery = rulesByName.filter((r) => {
    return getRulerRuleFingerprint(r, true).join('-') === getPromRuleFingerprint(rule, true).join('-');
  });

  if (rulesByLabelsAndAnnotationsAndQuery.length === 1) {
    return rulesByLabelsAndAnnotationsAndQuery[0];
  }

  // If there are still multiple identical matches, use position hash to disambiguate
  // This only works if both groups have the same structure (same number of rules in the same order)
  if (rulesByLabelsAndAnnotationsAndQuery.length > 1 && rulePositionHash) {
    for (const candidateRule of rulesByLabelsAndAnnotationsAndQuery) {
      const rulerRuleIndex = rulerRuleGroup.rules.indexOf(candidateRule);
      const rulerPositionHash = createRulePositionHash(rulerRuleIndex, rulerRuleGroup.rules.length);

      // Match if position hashes are identical
      if (rulerPositionHash === rulePositionHash) {
        return candidateRule;
      }
    }
  }

  return undefined;
}

type RulerRuleWithRulePosition = RulerCloudRuleDTO & {
  /**
   * Position hash encoding both the rule's index and the total number of rules in the group.
   * Format: "<index>:<totalRules>" (e.g., "0:3", "1:5")
   *
   * This is used to disambiguate between identical Ruler rules when matching them against
   * Prometheus rules. The hash ensures rules are matched by position only when both groups
   * have the same structure (same number of rules).
   *
   * @example
   * // Matching identical rules by position
   * Ruler rule at position 0 in a 2-rule group: rulePositionHash = "0:2"
   * Prometheus rule at position 0 in a 2-rule group: rulePositionHash = "0:2" → Match!
   * Prometheus rule at position 0 in a 3-rule group: rulePositionHash = "0:3" → No match
   */
  rulePositionHash: RulePositionHash;
};

export function getMatchingPromRule(
  promRuleGroup: PromRuleGroupDTO<PromRuleDTO>,
  rulerRuleWithPosition: RulerRuleWithRulePosition
) {
  const { rulePositionHash, ...rule } = rulerRuleWithPosition;

  // If all rule names are unique, we can use the rule name to find the rule. We don't need to hash the rule
  const rulesByName = promRuleGroup.rules.filter((r) => r.name === getRuleName(rule));
  if (rulesByName.length === 1) {
    return rulesByName[0];
  }

  // If we don't have a unique rule name, try to compare by labels and annotations
  const rulesByLabelsAndAnnotations = rulesByName.filter((r) => {
    return getPromRuleFingerprint(r, false).join('-') === getRulerRuleFingerprint(rule, false).join('-');
  });

  if (rulesByLabelsAndAnnotations.length === 1) {
    return rulesByLabelsAndAnnotations[0];
  }

  // As a last resort, compare including the query
  const rulesByLabelsAndAnnotationsAndQuery = rulesByName.filter((r) => {
    return getPromRuleFingerprint(r, true).join('-') === getRulerRuleFingerprint(rule, true).join('-');
  });

  if (rulesByLabelsAndAnnotationsAndQuery.length === 1) {
    return rulesByLabelsAndAnnotationsAndQuery[0];
  }

  // If there are still multiple identical matches, use position hash to disambiguate
  // This only works if both groups have the same structure (same number of rules in the same order)
  if (rulesByLabelsAndAnnotationsAndQuery.length > 1 && rulePositionHash) {
    for (const candidateRule of rulesByLabelsAndAnnotationsAndQuery) {
      const promRuleIndex = promRuleGroup.rules.indexOf(candidateRule);
      const promPositionHash = createRulePositionHash(promRuleIndex, promRuleGroup.rules.length);

      // Match if position hashes are identical
      if (promPositionHash === rulePositionHash) {
        return candidateRule;
      }
    }
  }

  return undefined;
}

interface GroupMatchingResult {
  matches: Map<RulerRuleDTO, PromRuleDTO>;
  promOnlyRules: PromRuleDTO[];
}

export function matchRulesGroup(
  rulerGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>,
  promGroup: PromRuleGroupDTO<PromRuleDTO>
): GroupMatchingResult {
  const matchingResult = rulerGroup.rules.reduce(
    (acc, rulerRule, index) => {
      const { matches, unmatchedPromRules } = acc;

      // Create ruler rule with position hash
      const rulerRuleWithPosition: RulerRuleWithRulePosition = {
        ...rulerRule,
        rulePositionHash: createRulePositionHash(index, rulerGroup.rules.length),
      };

      const promRule = getMatchingPromRule(promGroup, rulerRuleWithPosition);
      if (promRule) {
        matches.set(rulerRule, promRule);
        unmatchedPromRules.delete(promRule);
      }
      return acc;
    },
    { matches: new Map<RulerRuleDTO, PromRuleDTO>(), unmatchedPromRules: new Set(promGroup.rules) }
  );

  return { matches: matchingResult.matches, promOnlyRules: Array.from(matchingResult.unmatchedPromRules) };
}
