import { CombinedRule, CombinedRuleNamespace, Rule, RuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { useMemo, useRef } from 'react';
import { getAllRulesSources, isCloudRulesSource, isGrafanaRulesSource } from '../utils/datasource';
import { isAlertingRule, isAlertingRulerRule, isRecordingRulerRule } from '../utils/rules';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

interface CacheValue {
  promRules?: RuleNamespace[];
  rulerRules?: RulerRulesConfigDTO | null;
  result: CombinedRuleNamespace[];
}

// this little monster combines prometheus rules and ruler rules to produce a unfied data structure
export function useCombinedRuleNamespaces(): CombinedRuleNamespace[] {
  const promRulesResponses = useUnifiedAlertingSelector((state) => state.promRules);
  const rulerRulesResponses = useUnifiedAlertingSelector((state) => state.rulerRules);

  // cache results per rules source, so we only recalculate those for which results have actually changed
  const cache = useRef<Record<string, CacheValue>>({});

  return useMemo(() => {
    const retv = getAllRulesSources()
      .map((rulesSource): CombinedRuleNamespace[] => {
        const rulesSourceName = isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
        const promRules = promRulesResponses[rulesSourceName]?.result;
        const rulerRules = rulerRulesResponses[rulesSourceName]?.result;

        const cached = cache.current[rulesSourceName];
        if (cached && cached.promRules === promRules && cached.rulerRules === rulerRules) {
          return cached.result;
        }
        const namespaces: Record<string, CombinedRuleNamespace> = {};

        // first get all the ruler rules in
        Object.entries(rulerRules || {}).forEach(([namespaceName, groups]) => {
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
                    : isRecordingRulerRule(rule)
                    ? {
                        name: rule.record,
                        query: rule.expr,
                        labels: rule.labels || {},
                        annotations: {},
                        rulerRule: rule,
                      }
                    : {
                        name: rule.grafana_alert.title,
                        query: '',
                        labels: rule.grafana_alert.labels || {},
                        annotations: rule.grafana_alert.annotations || {},
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

            (group.rules ?? []).forEach((rule) => {
              const existingRule = combinedGroup!.rules.find((existingRule) => {
                return !existingRule.promRule && isCombinedRuleEqualToPromRule(existingRule, rule);
              });
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

        const result = Object.values(namespaces);
        if (isGrafanaRulesSource(rulesSource)) {
          // merge all groups in case of grafana
          result.forEach((namespace) => {
            namespace.groups = [
              {
                name: 'default',
                rules: namespace.groups.flatMap((g) => g.rules).sort((a, b) => a.name.localeCompare(b.name)),
              },
            ];
          });
        }
        cache.current[rulesSourceName] = { promRules, rulerRules, result };
        return result;
      })
      .flat();
    return retv;
  }, [promRulesResponses, rulerRulesResponses]);
}

function isCombinedRuleEqualToPromRule(combinedRule: CombinedRule, rule: Rule): boolean {
  if (combinedRule.name === rule.name) {
    return (
      JSON.stringify([hashQuery(combinedRule.query), combinedRule.labels, combinedRule.annotations]) ===
      JSON.stringify([hashQuery(rule.query), rule.labels || {}, isAlertingRule(rule) ? rule.annotations || {} : {}])
    );
  }
  return false;
}

// there can be slight differences in how prom & ruler render a query, this will hash them accounting for the differences
function hashQuery(query: string) {
  // one of them might be wrapped in parens
  if (query.length > 1 && query[0] === '(' && query[query.length - 1] === ')') {
    query = query.substr(1, query.length - 2);
  }
  // whitespace could be added or removed
  query = query.replace(/\s|\n/g, '');
  // labels matchers can be reordered, so sort the enitre string, esentially comparing just hte character counts
  return query.split('').sort().join('');
}
