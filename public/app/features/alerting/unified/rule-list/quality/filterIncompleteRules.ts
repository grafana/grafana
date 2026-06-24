import { compact } from 'lodash';

import { type Matcher } from 'app/plugins/datasource/alertmanager/types';

import { type IncompleteRule } from '../../hooks/useIncompleteRules';
import { type RulesFilter } from '../../search/rulesSearchParser';
import { labelsMatchMatchers } from '../../utils/alertmanager';
import { parseMatcher } from '../../utils/matchers';

// Mirrors the label matching used by the main rule list: a malformed matcher
// query falls back to matching any value for the given key.
function looseParseMatcher(matcherQuery: string): Matcher | undefined {
  try {
    return parseMatcher(matcherQuery);
  } catch {
    return { name: matcherQuery, value: '', isRegex: true, isEqual: true };
  }
}

function matchesName(rule: IncompleteRule, filter: RulesFilter): boolean {
  const name = rule.name.toLowerCase();
  if (filter.ruleName && !name.includes(filter.ruleName.toLowerCase())) {
    return false;
  }
  return filter.freeFormWords.every((word) => name.includes(word.toLowerCase()));
}

/**
 * Filters incomplete alert rules using the shared alerting RulesFilter so the Quality
 * tab supports the same folder, group, rule name and label matching as the rule list.
 * Filters not relevant to quality (state, health, data source, etc.) are ignored.
 */
export function filterIncompleteRules(rules: IncompleteRule[], filter: RulesFilter): IncompleteRule[] {
  const labelMatchers = compact(filter.labels.map(looseParseMatcher));

  return rules.filter((rule) => {
    if (filter.namespace && rule.folder !== filter.namespace) {
      return false;
    }
    if (filter.groupName && rule.group !== filter.groupName) {
      return false;
    }
    if (!matchesName(rule, filter)) {
      return false;
    }
    if (labelMatchers.length > 0 && !labelsMatchMatchers(rule.labels, labelMatchers)) {
      return false;
    }
    return true;
  });
}
