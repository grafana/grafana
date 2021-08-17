import { locationService } from '@grafana/runtime';
import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  AlertmanagerAlert,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  Silence,
  SilenceCreatePayload,
} from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO, NotifierDTO, ThunkResult } from 'app/types';
import { RuleIdentifier, RuleNamespace, RuleWithLocation } from 'app/types/unified-alerting';
import {
  PostableRulerRuleGroupDTO,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';
import { fetchNotifiers } from '../api/grafana';
import {
  expireSilence,
  fetchAlertManagerConfig,
  fetchAlerts,
  fetchAlertGroups,
  fetchSilences,
  createOrUpdateSilence,
  updateAlertManagerConfig,
  fetchStatus,
  deleteAlertManagerConfig,
} from '../api/alertmanager';
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
import { makeAMLink, retryWhile } from '../utils/misc';
import { isFetchError, withAppEvents, withSerializedError } from '../utils/redux';
import { formValuesToRulerAlertingRuleDTO, formValuesToRulerGrafanaRuleDTO } from '../utils/rule-form';
import {
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isGrafanaRulerRule,
  isPrometheusRuleIdentifier,
  isRulerNotSupportedResponse,
} from '../utils/rules';
import { addDefaultsToAlertmanagerConfig } from '../utils/alertmanager';
import { backendSrv } from 'app/core/services/backend_srv';
import * as ruleId from '../utils/rule-id';
import { isEmpty } from 'lodash';
import messageFromError from 'app/plugins/datasource/grafana-azure-monitor-datasource/utils/messageFromError';

const FETCH_CONFIG_RETRY_TIMEOUT = 30 * 1000;

export const fetchPromRulesAction = createAsyncThunk(
  'unifiedalerting/fetchPromRules',
  (rulesSourceName: string): Promise<RuleNamespace[]> => withSerializedError(fetchRules(rulesSourceName))
);

export const fetchAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/fetchAmConfig',
  (alertManagerSourceName: string): Promise<AlertManagerCortexConfig> =>
    withSerializedError(
      retryWhile(
        () => fetchAlertManagerConfig(alertManagerSourceName),
        // if config has been recently deleted, it takes a while for cortex start returning the default one.
        // retry for a short while instead of failing
        (e) => !!messageFromError(e)?.includes('alertmanager storage object not found'),
        FETCH_CONFIG_RETRY_TIMEOUT
      ).then((result) => {
        // if user config is empty for cortex alertmanager, try to get config from status endpoint
        if (
          isEmpty(result.alertmanager_config) &&
          isEmpty(result.template_files) &&
          alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME
        ) {
          return fetchStatus(alertManagerSourceName).then((status) => ({
            alertmanager_config: status.config,
            template_files: {},
          }));
        }
        return result;
      })
    )
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

export function fetchAllPromRulesAction(force = false): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { promRules } = getStore().unifiedAlerting;
    getAllRulesSourceNames().map((name) => {
      if (force || !promRules[name]?.loading) {
        dispatch(fetchPromRulesAction(name));
      }
    });
  };
}

async function findEditableRule(ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null> {
  if (isGrafanaRuleIdentifier(ruleIdentifier)) {
    const namespaces = await fetchRulerRules(GRAFANA_RULES_SOURCE_NAME);
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
    const group = await fetchRulerRulesGroup(ruleSourceName, namespace, groupName);

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
}

export const fetchEditableRuleAction = createAsyncThunk(
  'unifiedalerting/fetchEditableRule',
  (ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null> =>
    withSerializedError(findEditableRule(ruleIdentifier))
);

async function deleteRule(ruleWithLocation: RuleWithLocation): Promise<void> {
  const { ruleSourceName, namespace, group, rule } = ruleWithLocation;
  // in case of GRAFANA, each group implicitly only has one rule. delete the group.
  if (isGrafanaRulesSource(ruleSourceName)) {
    await deleteRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, namespace, group.name);
    return;
  }
  // in case of CLOUD
  // it was the last rule, delete the entire group
  if (group.rules.length === 1) {
    await deleteRulerRulesGroup(ruleSourceName, namespace, group.name);
    return;
  }
  // post the group with rule removed
  await setRulerRuleGroup(ruleSourceName, namespace, {
    ...group,
    rules: group.rules.filter((r) => r !== rule),
  });
}

export function deleteRuleAction(
  ruleIdentifier: RuleIdentifier,
  options: { navigateTo?: string } = {}
): ThunkResult<void> {
  /*
   * fetch the rules group from backend, delete group if it is found and+
   * reload ruler rules
   */
  return async (dispatch) => {
    withAppEvents(
      (async () => {
        const ruleWithLocation = await findEditableRule(ruleIdentifier);
        if (!ruleWithLocation) {
          throw new Error('Rule not found.');
        }
        await deleteRule(ruleWithLocation);
        // refetch rules for this rules source
        dispatch(fetchRulerRulesAction(ruleWithLocation.ruleSourceName));
        dispatch(fetchPromRulesAction(ruleWithLocation.ruleSourceName));

        if (options.navigateTo) {
          locationService.replace(options.navigateTo);
        }
      })(),
      {
        successMessage: 'Rule deleted.',
      }
    );
  };
}

async function saveLotexRule(values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier> {
  const { dataSourceName, group, namespace } = values;
  const formRule = formValuesToRulerAlertingRuleDTO(values);
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
        await setRulerRuleGroup(dataSourceName, namespace, payload);
        return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
      }
    }

    // if creating new rule or existing rule was in a different namespace/group, create new rule in target group

    const targetGroup = await fetchRulerRulesGroup(dataSourceName, namespace, group);

    const payload: RulerRuleGroupDTO = targetGroup
      ? {
          ...targetGroup,
          rules: [...targetGroup.rules, formRule],
        }
      : {
          name: group,
          rules: [formRule],
        };

    await setRulerRuleGroup(dataSourceName, namespace, payload);
    return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
  } else {
    throw new Error('Data source and location must be specified');
  }
}

async function saveGrafanaRule(values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier> {
  const { folder, evaluateEvery } = values;
  const formRule = formValuesToRulerGrafanaRuleDTO(values);
  if (folder) {
    // updating an existing rule...
    if (existing) {
      // refetch it to be sure we have the latest
      const freshExisting = await findEditableRule(ruleId.fromRuleWithLocation(existing));
      if (!freshExisting) {
        throw new Error('Rule not found.');
      }

      // if folder has changed, delete the old one
      if (freshExisting.namespace !== folder.title) {
        await deleteRule(freshExisting);
        // if same folder, repost the group with updated rule
      } else {
        const uid = (freshExisting.rule as RulerGrafanaRuleDTO).grafana_alert.uid!;
        formRule.grafana_alert.uid = uid;
        await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, freshExisting.namespace, {
          name: freshExisting.group.name,
          interval: evaluateEvery,
          rules: [formRule],
        });
        return { uid };
      }
    }

    // if creating new rule or folder was changed, create rule in a new group

    const existingNamespace = await fetchRulerRulesNamespace(GRAFANA_RULES_SOURCE_NAME, folder.title);

    // set group name to rule name, but be super paranoid and check that this group does not already exist
    let group = values.name;
    let idx = 1;
    while (!!existingNamespace.find((g) => g.name === group)) {
      group = `${values.name}-${++idx}`;
    }

    const payload: PostableRulerRuleGroupDTO = {
      name: group,
      interval: evaluateEvery,
      rules: [formRule],
    };
    await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, payload);

    // now refetch this group to get the uid, hah
    const result = await fetchRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, group);
    const newUid = (result?.rules[0] as RulerGrafanaRuleDTO)?.grafana_alert?.uid;
    if (newUid) {
      return { uid: newUid };
    } else {
      throw new Error('Failed to fetch created rule.');
    }
  } else {
    throw new Error('Folder must be specified');
  }
}

export const saveRuleFormAction = createAsyncThunk(
  'unifiedalerting/saveRuleForm',
  ({
    values,
    existing,
    redirectOnSave,
  }: {
    values: RuleFormValues;
    existing?: RuleWithLocation;
    redirectOnSave?: string;
  }): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          const { type } = values;
          // in case of system (cortex/loki)
          let identifier: RuleIdentifier;
          if (type === RuleFormType.cloud) {
            identifier = await saveLotexRule(values, existing);
            // in case of grafana managed
          } else if (type === RuleFormType.grafana) {
            identifier = await saveGrafanaRule(values, existing);
          } else {
            throw new Error('Unexpected rule form type');
          }
          if (redirectOnSave) {
            locationService.push(redirectOnSave);
          } else {
            // redirect to edit page
            const newLocation = `/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`;
            if (locationService.getLocation().pathname !== newLocation) {
              locationService.replace(newLocation);
            }
          }
        })()
      ),
      {
        successMessage: existing ? `Rule "${values.name}" updated.` : `Rule "${values.name}" saved.`,
        errorMessage: 'Failed to save rule',
      }
    )
);

export const fetchGrafanaNotifiersAction = createAsyncThunk(
  'unifiedalerting/fetchGrafanaNotifiers',
  (): Promise<NotifierDTO[]> => withSerializedError(fetchNotifiers())
);

interface UpdateAlertManagerConfigActionOptions {
  alertManagerSourceName: string;
  oldConfig: AlertManagerCortexConfig; // it will be checked to make sure it didn't change in the meanwhile
  newConfig: AlertManagerCortexConfig;
  successMessage?: string; // show toast on success
  redirectPath?: string; // where to redirect on success
  refetch?: boolean; // refetch config on success
}

export const updateAlertManagerConfigAction = createAsyncThunk<void, UpdateAlertManagerConfigActionOptions, {}>(
  'unifiedalerting/updateAMConfig',
  ({ alertManagerSourceName, oldConfig, newConfig, successMessage, redirectPath, refetch }, thunkAPI): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          const latestConfig = await fetchAlertManagerConfig(alertManagerSourceName);
          if (
            !(isEmpty(latestConfig.alertmanager_config) && isEmpty(latestConfig.template_files)) &&
            JSON.stringify(latestConfig) !== JSON.stringify(oldConfig)
          ) {
            throw new Error(
              'It seems configuration has been recently updated. Please reload page and try again to make sure that recent changes are not overwritten.'
            );
          }
          await updateAlertManagerConfig(alertManagerSourceName, addDefaultsToAlertmanagerConfig(newConfig));
          if (refetch) {
            await thunkAPI.dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
          }
          if (redirectPath) {
            locationService.push(makeAMLink(redirectPath, alertManagerSourceName));
          }
        })()
      ),
      {
        successMessage,
      }
    )
);

export const fetchAmAlertsAction = createAsyncThunk(
  'unifiedalerting/fetchAmAlerts',
  (alertManagerSourceName: string): Promise<AlertmanagerAlert[]> =>
    withSerializedError(fetchAlerts(alertManagerSourceName, [], true, true, true))
);

export const expireSilenceAction = (alertManagerSourceName: string, silenceId: string): ThunkResult<void> => {
  return async (dispatch) => {
    await withAppEvents(expireSilence(alertManagerSourceName, silenceId), {
      successMessage: 'Silence expired.',
    });
    dispatch(fetchSilencesAction(alertManagerSourceName));
    dispatch(fetchAmAlertsAction(alertManagerSourceName));
  };
};

type UpdateSilenceActionOptions = {
  alertManagerSourceName: string;
  payload: SilenceCreatePayload;
  exitOnSave: boolean;
  successMessage?: string;
};

export const createOrUpdateSilenceAction = createAsyncThunk<void, UpdateSilenceActionOptions, {}>(
  'unifiedalerting/updateSilence',
  ({ alertManagerSourceName, payload, exitOnSave, successMessage }): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          await createOrUpdateSilence(alertManagerSourceName, payload);
          if (exitOnSave) {
            locationService.push('/alerting/silences');
          }
        })()
      ),
      {
        successMessage,
      }
    )
);

export const deleteReceiverAction = (receiverName: string, alertManagerSourceName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    const config = getState().unifiedAlerting.amConfigs?.[alertManagerSourceName]?.result;
    if (!config) {
      throw new Error(`Config for ${alertManagerSourceName} not found`);
    }
    if (!config.alertmanager_config.receivers?.find((receiver) => receiver.name === receiverName)) {
      throw new Error(`Cannot delete receiver ${receiverName}: not found in config.`);
    }
    const newConfig: AlertManagerCortexConfig = {
      ...config,
      alertmanager_config: {
        ...config.alertmanager_config,
        receivers: config.alertmanager_config.receivers.filter((receiver) => receiver.name !== receiverName),
      },
    };
    return dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: config,
        alertManagerSourceName,
        successMessage: 'Contact point deleted.',
        refetch: true,
      })
    );
  };
};

export const deleteTemplateAction = (templateName: string, alertManagerSourceName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    const config = getState().unifiedAlerting.amConfigs?.[alertManagerSourceName]?.result;
    if (!config) {
      throw new Error(`Config for ${alertManagerSourceName} not found`);
    }
    if (typeof config.template_files?.[templateName] !== 'string') {
      throw new Error(`Cannot delete template ${templateName}: not found in config.`);
    }
    const newTemplates = { ...config.template_files };
    delete newTemplates[templateName];
    const newConfig: AlertManagerCortexConfig = {
      ...config,
      alertmanager_config: {
        ...config.alertmanager_config,
        templates: config.alertmanager_config.templates?.filter((existing) => existing !== templateName),
      },
      template_files: newTemplates,
    };
    return dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: config,
        alertManagerSourceName,
        successMessage: 'Template deleted.',
        refetch: true,
      })
    );
  };
};

export const fetchFolderAction = createAsyncThunk(
  'unifiedalerting/fetchFolder',
  (uid: string): Promise<FolderDTO> => withSerializedError(backendSrv.getFolderByUid(uid))
);

export const fetchFolderIfNotFetchedAction = (uid: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    if (!getState().unifiedAlerting.folders[uid]?.dispatched) {
      dispatch(fetchFolderAction(uid));
    }
  };
};

export const fetchAlertGroupsAction = createAsyncThunk(
  'unifiedalerting/fetchAlertGroups',
  (alertManagerSourceName: string): Promise<AlertmanagerGroup[]> => {
    return withSerializedError(fetchAlertGroups(alertManagerSourceName));
  }
);

export const checkIfLotexSupportsEditingRulesAction = createAsyncThunk(
  'unifiedalerting/checkIfLotexRuleEditingSupported',
  async (rulesSourceName: string): Promise<boolean> =>
    withAppEvents(
      (async () => {
        try {
          await fetchRulerRulesGroup(rulesSourceName, 'test', 'test');
          return true;
        } catch (e) {
          if (
            (isFetchError(e) &&
              (e.data.message?.includes('GetRuleGroup unsupported in rule local store') || // "local" rule storage
                e.data.message?.includes('page not found'))) || // ruler api disabled
            e.message?.includes('404 from rules config endpoint') // ruler api disabled
          ) {
            return false;
          }
          throw e;
        }
      })(),
      {
        errorMessage: `Failed to determine if "${rulesSourceName}" allows editing rules`,
      }
    )
);

export const deleteAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/deleteAlertManagerConfig',
  async (alertManagerSourceName: string, thunkAPI): Promise<void> => {
    return withAppEvents(
      withSerializedError(
        (async () => {
          await deleteAlertManagerConfig(alertManagerSourceName);
          await thunkAPI.dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
        })()
      ),
      {
        errorMessage: 'Failed to reset Alertmanager configuration',
        successMessage: 'Alertmanager configuration reset.',
      }
    );
  }
);
