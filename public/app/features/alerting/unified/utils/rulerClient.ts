import { RuleIdentifier, RulerDataSourceConfig, RuleWithLocation } from 'app/types/unified-alerting';
import { PostableRulerRuleGroupDTO, RulerGrafanaRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';
import {
  deleteRulerRulesGroup,
  fetchRulerRulesGroup,
  fetchRulerRulesNamespace,
  fetchRulerRules,
  setRulerRuleGroup,
} from '../api/ruler';
import { RuleFormValues } from '../types/rule-form';
import * as ruleId from '../utils/rule-id';
import { GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from './datasource';
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

export function getUniqueGroupName(currentGroupName: string, existingGroups: RulerRuleGroupDTO[]) {
  let newGroupName = currentGroupName;
  let idx = 1;
  while (!!existingGroups.find((g) => g.name === newGroupName)) {
    newGroupName = `${currentGroupName}-${++idx}`;
  }

  return newGroupName;
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
    const { ruleSourceName, namespace, group, rule } = ruleWithLocation;
    // in case of GRAFANA, each group implicitly only has one rule. delete the group.
    if (isGrafanaRulesSource(ruleSourceName)) {
      await deleteRulerRulesGroup(rulerConfig, namespace, group.name);
      return;
    }
    // in case of CLOUD
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

  const saveGrafanaRule = async (values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier> => {
    const { folder, evaluateEvery } = values;
    const formRule = formValuesToRulerGrafanaRuleDTO(values);

    if (!folder) {
      throw new Error('Folder must be specified');
    }

    // updating an existing rule...
    if (existing) {
      // refetch it to be sure we have the latest
      const freshExisting = await findEditableRule(ruleId.fromRuleWithLocation(existing));
      if (!freshExisting) {
        throw new Error('Rule not found.');
      }

      // if same folder, repost the group with updated rule
      if (freshExisting.namespace === folder.title) {
        const uid = (freshExisting.rule as RulerGrafanaRuleDTO).grafana_alert.uid!;
        formRule.grafana_alert.uid = uid;
        await setRulerRuleGroup(rulerConfig, freshExisting.namespace, {
          name: freshExisting.group.name,
          interval: evaluateEvery,
          rules: [formRule],
        });
        return { uid, ruleSourceName: 'grafana' };
      }
    }

    // if creating new rule or folder was changed, create rule in a new group
    const targetFolderGroups = await fetchRulerRulesNamespace(rulerConfig, folder.title);

    // set group name to rule name, but be super paranoid and check that this group does not already exist
    const groupName = getUniqueGroupName(values.name, targetFolderGroups);
    formRule.grafana_alert.title = groupName;

    const payload: PostableRulerRuleGroupDTO = {
      name: groupName,
      interval: evaluateEvery,
      rules: [formRule],
    };
    await setRulerRuleGroup(rulerConfig, folder.title, payload);

    // now refetch this group to get the uid, hah
    const result = await fetchRulerRulesGroup(rulerConfig, folder.title, groupName);
    const newUid = (result?.rules[0] as RulerGrafanaRuleDTO)?.grafana_alert?.uid;
    if (newUid) {
      // if folder has changed, delete the old one
      if (existing) {
        const freshExisting = await findEditableRule(ruleId.fromRuleWithLocation(existing));
        if (freshExisting && freshExisting.namespace !== folder.title) {
          await deleteRule(freshExisting);
        }
      }

      return { uid: newUid, ruleSourceName: 'grafana' };
    } else {
      throw new Error('Failed to fetch created rule.');
    }
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
