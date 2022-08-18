import { RuleIdentifier, RulerDataSourceConfig, RuleWithLocation } from 'app/types/unified-alerting';
import {
  PostableRuleGrafanaRuleDTO,
  PostableRulerRuleGroupDTO,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { deleteRulerRulesGroup, fetchRulerRulesGroup, fetchRulerRules, setRulerRuleGroup } from '../api/ruler';
import { RuleFormValues } from '../types/rule-form';
import * as ruleId from '../utils/rule-id';

import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { formValuesToRulerGrafanaRuleDTO, formValuesToRulerRuleDTO } from './rule-form';
import {
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isGrafanaRulerRule,
  isPrometheusRuleIdentifier,
} from './rules';

export interface RulerClient {
  findEditableRule(ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null>;
  deleteRule(ruleWithLocation: RuleWithLocation): Promise<void>;
  saveLotexRule(values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier>;
  saveGrafanaRule(values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier>;
}

export function getRulerClient(rulerConfig: RulerDataSourceConfig): RulerClient {
  const findEditableRule = async (ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null> => {
    if (isGrafanaRuleIdentifier(ruleIdentifier)) {
      const namespaces = await fetchRulerRules(rulerConfig);
      // find namespace and group that contains the uid for the rule
      for (const [namespace, groups] of Object.entries(namespaces)) {
        for (const group of groups) {
          const rule = group.rules.find(
            (rule) => isGrafanaRulerRule(rule) && rule.grafana_alert?.uid === ruleIdentifier.uid
          );
          if (rule) {
            return {
              group,
              ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
              namespace: namespace,
              rule,
            };
          }
        }
      }
    }

    if (isCloudRuleIdentifier(ruleIdentifier)) {
      const { ruleSourceName, namespace, groupName } = ruleIdentifier;
      const group = await fetchRulerRulesGroup(rulerConfig, namespace, groupName);

      if (!group) {
        return null;
      }

      const rule = group.rules.find((rule) => {
        const identifier = ruleId.fromRulerRule(ruleSourceName, namespace, group.name, rule);
        return ruleId.equal(identifier, ruleIdentifier);
      });

      if (!rule) {
        return null;
      }

      return {
        group,
        ruleSourceName,
        namespace,
        rule,
      };
    }

    if (isPrometheusRuleIdentifier(ruleIdentifier)) {
      throw new Error('Native prometheus rules can not be edited in grafana.');
    }

    return null;
  };

  const deleteRule = async (ruleWithLocation: RuleWithLocation): Promise<void> => {
    const { namespace, group, rule } = ruleWithLocation;

    // it was the last rule, delete the entire group
    if (group.rules.length === 1) {
      await deleteRulerRulesGroup(rulerConfig, namespace, group.name);
      return;
    }
    // post the group with rule removed
    await setRulerRuleGroup(rulerConfig, namespace, {
      ...group,
      rules: group.rules.filter((r) => r !== rule),
    });
  };

  const saveLotexRule = async (values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier> => {
    const { dataSourceName, group, namespace } = values;
    const formRule = formValuesToRulerRuleDTO(values);
    if (dataSourceName && group && namespace) {
      // if we're updating a rule...
      if (existing) {
        // refetch it so we always have the latest greatest
        const freshExisting = await findEditableRule(ruleId.fromRuleWithLocation(existing));
        if (!freshExisting) {
          throw new Error('Rule not found.');
        }
        // if namespace or group was changed, delete the old rule
        if (freshExisting.namespace !== namespace || freshExisting.group.name !== group) {
          await deleteRule(freshExisting);
        } else {
          // if same namespace or group, update the group replacing the old rule with new
          const payload = {
            ...freshExisting.group,
            rules: freshExisting.group.rules.map((existingRule) =>
              existingRule === freshExisting.rule ? formRule : existingRule
            ),
          };
          await setRulerRuleGroup(rulerConfig, namespace, payload);
          return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
        }
      }

      // if creating new rule or existing rule was in a different namespace/group, create new rule in target group

      const targetGroup = await fetchRulerRulesGroup(rulerConfig, namespace, group);

      const payload: RulerRuleGroupDTO = targetGroup
        ? {
            ...targetGroup,
            rules: [...targetGroup.rules, formRule],
          }
        : {
            name: group,
            rules: [formRule],
          };

      await setRulerRuleGroup(rulerConfig, namespace, payload);
      return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
    } else {
      throw new Error('Data source and location must be specified');
    }
  };

  const saveGrafanaRule = async (values: RuleFormValues, existingRule?: RuleWithLocation): Promise<RuleIdentifier> => {
    const { folder, group, evaluateEvery } = values;
    if (!folder) {
      throw new Error('Folder must be specified');
    }

    const newRule = formValuesToRulerGrafanaRuleDTO(values);
    const namespace = folder.title;
    const groupSpec = { name: group, interval: evaluateEvery };

    if (!existingRule) {
      return addRuleToNamespaceAndGroup(namespace, groupSpec, newRule);
    }

    // we'll fetch the existing group again, someone might have updated it while we were editing a rule
    const freshExisting = await findEditableRule(ruleId.fromRuleWithLocation(existingRule));
    if (!freshExisting) {
      throw new Error('Rule not found.');
    }

    const sameNamespace = freshExisting.namespace === namespace;
    const sameGroup = freshExisting.group.name === values.group;
    const sameLocation = sameNamespace && sameGroup;

    if (sameLocation) {
      // we're update a rule in the same namespace and group
      return updateGrafanaRule(freshExisting, newRule, evaluateEvery);
    } else {
      // we're moving a rule to either a different group or namespace
      return moveGrafanaRule(namespace, groupSpec, freshExisting, newRule);
    }
  };

  const addRuleToNamespaceAndGroup = async (
    namespace: string,
    group: { name: string; interval: string },
    newRule: PostableRuleGrafanaRuleDTO
  ): Promise<RuleIdentifier> => {
    const existingGroup = await fetchRulerRulesGroup(rulerConfig, namespace, group.name);
    if (!existingGroup) {
      throw new Error(`No group found with name "${group.name}"`);
    }

    const payload: PostableRulerRuleGroupDTO = {
      name: group.name,
      interval: group.interval,
      rules: (existingGroup.rules ?? []).concat(newRule as RulerGrafanaRuleDTO),
    };

    await setRulerRuleGroup(rulerConfig, namespace, payload);

    return { uid: newRule.grafana_alert.uid ?? '', ruleSourceName: GRAFANA_RULES_SOURCE_NAME };
  };

  // move the rule to another namespace / groupname
  const moveGrafanaRule = async (
    namespace: string,
    group: { name: string; interval: string },
    existingRule: RuleWithLocation,
    newRule: PostableRuleGrafanaRuleDTO
  ): Promise<RuleIdentifier> => {
    // make sure our updated alert has the same UID as before
    // that way the rule is automatically moved to the new namespace / group name
    copyGrafanaUID(existingRule, newRule);

    // add the new rule to the requested namespace and group
    const identifier = await addRuleToNamespaceAndGroup(namespace, group, newRule);

    return identifier;
  };

  const updateGrafanaRule = async (
    existingRule: RuleWithLocation,
    newRule: PostableRuleGrafanaRuleDTO,
    interval: string
  ): Promise<RuleIdentifier> => {
    // make sure our updated alert has the same UID as before
    copyGrafanaUID(existingRule, newRule);

    // create the new array of rules we want to send to the group. Keep the order of alerts in the group.
    const newRules = existingRule.group.rules.map((rule) => {
      if (!isGrafanaRulerRule(rule)) {
        return rule;
      }
      if (rule.grafana_alert.uid === existingRule.rule.grafana_alert.uid) {
        return newRule;
      }
      return rule;
    });

    await setRulerRuleGroup(rulerConfig, existingRule.namespace, {
      name: existingRule.group.name,
      interval: interval,
      rules: newRules,
    });

    return { uid: existingRule.rule.grafana_alert.uid, ruleSourceName: GRAFANA_RULES_SOURCE_NAME };
  };

  // Would be nice to somehow align checking of ruler type between different methods
  // Maybe each datasource should have its own ruler client implementation
  return {
    findEditableRule,
    deleteRule,
    saveLotexRule,
    saveGrafanaRule,
  };
}

//copy the Grafana rule UID from the old rule to the new rule
function copyGrafanaUID(
  oldRule: RuleWithLocation,
  newRule: PostableRuleGrafanaRuleDTO
): asserts oldRule is RuleWithLocation<RulerGrafanaRuleDTO> {
  // type guard to make sure we're working with a Grafana managed rule
  if (!isGrafanaRulerRule(oldRule.rule)) {
    throw new Error('The rule is not a Grafana managed rule');
  }

  const uid = oldRule.rule.grafana_alert.uid;
  newRule.grafana_alert.uid = uid;
}
