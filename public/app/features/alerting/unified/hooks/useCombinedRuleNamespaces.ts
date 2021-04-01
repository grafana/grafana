import { CombinedRule, CombinedRuleNamespace, Rule, RulesSource } from 'app/types/unified-alerting';
import { useMemo } from 'react';
import { getAllRulesSources, isCloudRulesSource } from '../utils/datasource';
import { isAlertingRule, isAlertingRulerRule } from '../utils/rules';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

// this little monster combines prometheus rules and ruler rules to produce a unfied data structure
export function useCombinedRuleNamespaces(): CombinedRuleNamespace[] {
  const promRulesResponses = useUnifiedAlertingSelector((state) => state.promRules);
  const rulerRulesResponses = useUnifiedAlertingSelector((state) => state.rulerRules);

  return useMemo(() => {
    return getAllRulesSources()
      .map((rulesSource): CombinedRuleNamespace[] => {
        const rulesSourceName = isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
        const promRules = promRulesResponses[rulesSourceName]?.result;
        const rulerRules = rulerRulesResponses[rulesSourceName]?.result || {};
        const namespaces: Record<string, CombinedRuleNamespace> = {};

        // first get all the ruler rules in
        Object.entries(rulerRules).forEach(([namespaceName, groups]) => {
          namespaces[namespaceName] = {
            rulesSource,
            name: namespaceName,
            groups: groups.map((group) => ({
              name: group.name,
              rules: group.rules.map(
                (rule): CombinedRule =>
                  isAlertingRulerRule(rule)
                    ? {
                        name: rule.alert,
                        query: rule.expr,
                        labels: rule.labels || {},
                        annotations: rule.annotations || {},
                        rulerRule: rule,
                      }
                    : {
                        name: rule.record,
                        query: rule.expr,
                        labels: rule.labels || {},
                        annotations: {},
                        rulerRule: rule,
                      }
              ),
            })),
          };
        });

        // then correlate with prometheus rules
        promRules?.forEach(({ name: namespaceName, groups }) => {
          const ns = (namespaces[namespaceName] = namespaces[namespaceName] || {
            rulesSource,
            name: namespaceName,
            groups: [],
          });

          groups.forEach((group) => {
            let combinedGroup = ns.groups.find((g) => g.name === group.name);
            if (!combinedGroup) {
              combinedGroup = {
                name: group.name,
                rules: [],
              };
              ns.groups.push(combinedGroup);
            }

            group.rules.forEach((rule) => {
              const existingRule = combinedGroup!.rules.find(
                (existingRule) =>
                  isCombinedRuleEqualToPromRule(rulesSource, existingRule, rule) && !existingRule.promRule
              );
              if (existingRule) {
                existingRule.promRule = rule;
              } else {
                combinedGroup!.rules.push({
                  name: rule.name,
                  query: rule.query,
                  labels: rule.labels || {},
                  annotations: isAlertingRule(rule) ? rule.annotations || {} : {},
                  promRule: rule,
                });
              }
            });
          });
        });

        return Object.values(namespaces);
      })
      .flat();
  }, [promRulesResponses, rulerRulesResponses]);
}

function isCombinedRuleEqualToPromRule(rulesSource: RulesSource, combinedRule: CombinedRule, rule: Rule): boolean {
  return (
    combinedRule.name === rule.name &&
    JSON.stringify([hashQuery(rulesSource, combinedRule.query), combinedRule.labels, combinedRule.annotations]) ===
      JSON.stringify([
        hashQuery(rulesSource, rule.query),
        rule.labels || {},
        isAlertingRule(rule) ? rule.annotations || {} : {},
      ])
  );
}

// it seems loki prom endpoint can return query surrounded with parens, while ruler endpoint does not
function hashQuery(rulesSource: RulesSource, query: string) {
  if (isCloudRulesSource(rulesSource) && rulesSource.type === 'loki') {
    if (query.length > 1 && query[0] === '(' && query[query.length - 1] === ')') {
      query = query.substr(1, query.length - 2);
    }
    query = query.replace(/\s/g, '');
  }
  return query;
}
