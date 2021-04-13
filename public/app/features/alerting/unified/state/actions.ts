import { AppEvents } from '@grafana/data';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { appEvents } from 'app/core/core';
import { AlertManagerCortexConfig, Silence } from 'app/plugins/datasource/alertmanager/types';
import { ThunkResult } from 'app/types';
import { RuleIdentifier, RuleLocation, RuleNamespace } from 'app/types/unified-alerting';
import {
  RulerGrafanaRuleDTO,
  RulerRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';
import { fetchAlertManagerConfig, fetchSilences } from '../api/alertmanager';
import { fetchRules } from '../api/prometheus';
import {
  deleteRulerRulesGroup,
  fetchRulerRules,
  fetchRulerRulesGroup,
  fetchRulerRulesNamespace,
  setRulerRuleGroup,
} from '../api/ruler';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { getAllRulesSourceNames, GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from '../utils/datasource';
import { withSerializedError } from '../utils/redux';
import { formValuesToRulerAlertingRuleDTO, formValuesToRulerGrafanaRuleDTO } from '../utils/rule-form';
import { hashRulerRule, isGrafanaRuleIdentifier, isRulerNotSupportedResponse } from '../utils/rules';

export const fetchPromRulesAction = createAsyncThunk(
  'unifiedalerting/fetchPromRules',
  (rulesSourceName: string): Promise<RuleNamespace[]> => withSerializedError(fetchRules(rulesSourceName))
);

export const fetchAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/fetchAmConfig',
  (alertManagerSourceName: string): Promise<AlertManagerCortexConfig> =>
    withSerializedError(fetchAlertManagerConfig(alertManagerSourceName))
);

export const fetchRulerRulesAction = createAsyncThunk(
  'unifiedalerting/fetchRulerRules',
  (rulesSourceName: string): Promise<RulerRulesConfigDTO | null> => {
    return withSerializedError(fetchRulerRules(rulesSourceName));
  }
);

export const fetchSilencesAction = createAsyncThunk(
  'unifiedalerting/fetchSilences',
  (alertManagerSourceName: string): Promise<Silence[]> => {
    return withSerializedError(fetchSilences(alertManagerSourceName));
  }
);

// this will only trigger ruler rules fetch if rules are not loaded yet and request is not in flight
export function fetchRulerRulesIfNotFetchedYet(dataSourceName: string): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { rulerRules } = getStore().unifiedAlerting;
    const resp = rulerRules[dataSourceName];
    if (!resp?.result && !(resp && isRulerNotSupportedResponse(resp)) && !resp?.loading) {
      dispatch(fetchRulerRulesAction(dataSourceName));
    }
  };
}

export function fetchAllPromAndRulerRulesAction(force = false): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { promRules, rulerRules } = getStore().unifiedAlerting;
    getAllRulesSourceNames().map((name) => {
      if (force || !promRules[name]?.loading) {
        dispatch(fetchPromRulesAction(name));
      }
      if (force || !rulerRules[name]?.loading) {
        dispatch(fetchRulerRulesAction(name));
      }
    });
  };
}

async function findExistingRule(
  ruleIdentifier: RuleIdentifier
): Promise<{ location: RuleLocation; group: RulerRuleGroupDTO; rule: RulerRuleDTO } | null> {
  if (isGrafanaRuleIdentifier(ruleIdentifier)) {
    const namespaces = await fetchRulerRules(GRAFANA_RULES_SOURCE_NAME);
    // find namespace and group that contains the uid for the rule
    for (const [namespace, groups] of Object.entries(namespaces)) {
      for (const group of groups) {
        const rule = group.rules.find((rule: RulerGrafanaRuleDTO) => rule.grafana_alert?.uid === ruleIdentifier.uid);
        if (rule) {
          return {
            group,
            location: {
              ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
              namespace: namespace,
              groupName: group.name,
            },
            rule,
          };
        }
      }
    }
  } else {
    const { ruleSourceName, namespace, groupName, ruleHash } = ruleIdentifier;
    const group = await fetchRulerRulesGroup(ruleSourceName, namespace, groupName);
    if (group) {
      const rule = group.rules.find((rule) => hashRulerRule(rule) === ruleHash);
      if (rule) {
        return {
          group,
          location: { ruleSourceName, namespace, groupName },
          rule,
        };
      }
    }
  }
  return null;
}

export function deleteRuleAction(ruleIdentifier: RuleIdentifier): ThunkResult<void> {
  /*
   * fetch the rules group from backend, delete group if it is found and+
   * reload ruler rules
   */
  return async (dispatch) => {
    const ruleWithLocation = await findExistingRule(ruleIdentifier);
    if (!ruleWithLocation) {
      throw new Error('Rule not found.');
    }
    const {
      location: { ruleSourceName, namespace, groupName },
      group,
      rule,
    } = ruleWithLocation;
    // in case of GRAFANA
    if (isGrafanaRulesSource(ruleSourceName)) {
      await deleteRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, namespace, groupName);
      // in case of CLOUD
    } else {
      // it was the last rule, delete the entire group
      if (group.rules.length === 1) {
        await deleteRulerRulesGroup(ruleSourceName, namespace, groupName);
      } else {
        // post the group with rule removed
        await setRulerRuleGroup(ruleSourceName, namespace, {
          ...group,
          rules: group.rules.filter((r) => r !== rule),
        });
      }
    }
    // refetch rules for this rules source
    return dispatch(fetchRulerRulesAction(ruleSourceName));
  };
}

async function saveLotexRule(values: RuleFormValues): Promise<void> {
  const { dataSourceName, location } = values;
  if (dataSourceName && location) {
    const existingGroup = await fetchRulerRulesGroup(dataSourceName, location.namespace, location.group);
    const rule = formValuesToRulerAlertingRuleDTO(values);

    // @TODO handle "update" case
    const payload: RulerRuleGroupDTO = existingGroup
      ? {
          ...existingGroup,
          rules: [...existingGroup.rules, rule],
        }
      : {
          name: location.group,
          rules: [rule],
        };

    await setRulerRuleGroup(dataSourceName, location.namespace, payload);
  } else {
    throw new Error('Data source and location must be specified');
  }
}

async function saveGrafanaRule(values: RuleFormValues): Promise<void> {
  const { folder, evaluateEvery } = values;
  if (folder) {
    const existingNamespace = await fetchRulerRulesNamespace(GRAFANA_RULES_SOURCE_NAME, folder.title);

    // set group name to rule name, but be super paranoid and check that this group does not already exist
    let group = values.name;
    let idx = 1;
    while (!!existingNamespace.find((g) => g.name === group)) {
      group = `${values.name}-${++idx}`;
    }

    const rule = formValuesToRulerGrafanaRuleDTO(values);

    const payload: RulerRuleGroupDTO = {
      name: group,
      interval: evaluateEvery,
      rules: [rule],
    };
    await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, payload);
  } else {
    throw new Error('Folder must be specified');
  }
}

export const saveRuleFormAction = createAsyncThunk(
  'unifiedalerting/saveRuleForm',
  (values: RuleFormValues): Promise<void> =>
    withSerializedError(
      (async () => {
        const { type } = values;
        // in case of system (cortex/loki)
        if (type === RuleFormType.system) {
          await saveLotexRule(values);
          // in case of grafana managed
        } else if (type === RuleFormType.threshold) {
          await saveGrafanaRule(values);
        } else {
          throw new Error('Unexpected rule form type');
        }
        appEvents.emit(AppEvents.alertSuccess, ['Rule saved.']);
      })()
    )
);
