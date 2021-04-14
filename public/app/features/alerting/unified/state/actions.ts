import { AppEvents } from '@grafana/data';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { appEvents } from 'app/core/core';
import { AlertManagerCortexConfig, Silence } from 'app/plugins/datasource/alertmanager/types';
import { ThunkResult } from 'app/types';
import { RuleLocation, RuleNamespace } from 'app/types/unified-alerting';
import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
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
import { getAllRulesSourceNames, GRAFANA_RULES_SOURCE_NAME, isCloudRulesSource } from '../utils/datasource';
import { withSerializedError } from '../utils/redux';
import { formValuesToRulerAlertingRuleDTO, formValuesToRulerGrafanaRuleDTO } from '../utils/rule-form';
import { hashRulerRule, isRulerNotSupportedResponse } from '../utils/rules';

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

export function deleteRuleAction(ruleLocation: RuleLocation): ThunkResult<void> {
  /*
   * fetch the rules group from backend, delete group if it is found and+
   * reload ruler rules
   */
  return async (dispatch) => {
    const { namespace, groupName, ruleSourceName, ruleHash } = ruleLocation;
    //const group = await fetchRulerRulesGroup(ruleSourceName, namespace, groupName);
    const groups = await fetchRulerRulesNamespace(ruleSourceName, namespace);
    const group = groups.find((group) => group.name === groupName);
    if (!group) {
      throw new Error('Failed to delete rule: group not found.');
    }
    const existingRule = group.rules.find((rule) => hashRulerRule(rule) === ruleHash);
    if (!existingRule) {
      throw new Error('Failed to delete rule: group not found.');
    }
    // for cloud datasources, delete group if this rule is the last rule
    if (group.rules.length === 1 && isCloudRulesSource(ruleSourceName)) {
      await deleteRulerRulesGroup(ruleSourceName, namespace, groupName);
    } else {
      await setRulerRuleGroup(ruleSourceName, namespace, {
        ...group,
        rules: group.rules.filter((rule) => rule !== existingRule),
      });
    }
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
