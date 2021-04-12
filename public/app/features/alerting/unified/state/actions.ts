import { createAsyncThunk } from '@reduxjs/toolkit';
import { AlertManagerCortexConfig, Silence } from 'app/plugins/datasource/alertmanager/types';
import { ThunkResult } from 'app/types';
import { RuleLocation, RuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { fetchAlertManagerConfig, fetchSilences } from '../api/alertmanager';
import { fetchRules } from '../api/prometheus';
import { deleteRulerRulesGroup, fetchRulerRules, fetchRulerRulesNamespace, setRulerRuleGroup } from '../api/ruler';
import { getAllRulesSourceNames, isCloudRulesSource } from '../utils/datasource';
import { withSerializedError } from '../utils/redux';
import { hashRulerRule } from '../utils/rules';

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

export function fetchAllPromAndRulerRules(force = false): ThunkResult<void> {
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
