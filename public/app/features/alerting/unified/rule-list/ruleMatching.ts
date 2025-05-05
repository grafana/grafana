import { Rule } from 'app/types/unified-alerting';
import {
  PromRuleDTO,
  PromRuleGroupDTO,
  RulerCloudRuleDTO,
  RulerRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { getPromRuleFingerprint, getRulerRuleFingerprint } from '../utils/rule-id';
import { getRuleName } from '../utils/rules';

export function getMatchingRulerRule(rulerRuleGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>, rule: Rule) {
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

  return undefined;
}

export function getMatchingPromRule(promRuleGroup: PromRuleGroupDTO<PromRuleDTO>, rule: RulerCloudRuleDTO) {
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
    (acc, rulerRule) => {
      const { matches, unmatchedPromRules } = acc;

      const promRule = getMatchingPromRule(promGroup, rulerRule);
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
