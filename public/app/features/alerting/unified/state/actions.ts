import { createAsyncThunk } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';

import { getBackendSrv, locationService } from '@grafana/runtime';
import {
  AlertmanagerAlert,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagersResponse,
  Receiver,
  Silence,
  SilenceCreatePayload,
  TestReceiversAlert,
} from 'app/plugins/datasource/alertmanager/types';
import messageFromError from 'app/plugins/datasource/grafana-azure-monitor-datasource/utils/messageFromError';
import { FolderDTO, NotifierDTO, StoreState, ThunkResult } from 'app/types';
import {
  CombinedRuleGroup,
  CombinedRuleNamespace,
  PromBasedDataSource,
  RuleIdentifier,
  RuleNamespace,
  RulerDataSourceConfig,
  RuleWithLocation,
  StateHistoryItem,
} from 'app/types/unified-alerting';
import { PromApplication, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import {
  addAlertManagers,
  createOrUpdateSilence,
  deleteAlertManagerConfig,
  expireSilence,
  fetchAlertGroups,
  fetchAlertManagerConfig,
  fetchAlerts,
  fetchExternalAlertmanagerConfig,
  fetchExternalAlertmanagers,
  fetchSilences,
  fetchStatus,
  testReceivers,
  updateAlertManagerConfig,
} from '../api/alertmanager';
import { fetchAnnotations } from '../api/annotations';
import { discoverFeatures } from '../api/buildInfo';
import { fetchNotifiers } from '../api/grafana';
import { FetchPromRulesFilter, fetchRules } from '../api/prometheus';
import {
  deleteNamespace,
  deleteRulerRulesGroup,
  fetchRulerRules,
  FetchRulerRulesFilter,
  setRulerRuleGroup,
} from '../api/ruler';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { addDefaultsToAlertmanagerConfig, removeMuteTimingFromRoute } from '../utils/alertmanager';
import {
  getAllRulesSourceNames,
  getRulesDataSource,
  getRulesSourceName,
  GRAFANA_RULES_SOURCE_NAME,
  isVanillaPrometheusAlertManagerDataSource,
} from '../utils/datasource';
import { makeAMLink, retryWhile } from '../utils/misc';
import { AsyncRequestMapSlice, withAppEvents, withSerializedError } from '../utils/redux';
import * as ruleId from '../utils/rule-id';
import { getRulerClient } from '../utils/rulerClient';
import { isRulerNotSupportedResponse } from '../utils/rules';

const FETCH_CONFIG_RETRY_TIMEOUT = 30 * 1000;

function getDataSourceConfig(getState: () => unknown, rulesSourceName: string) {
  const dataSources = (getState() as StoreState).unifiedAlerting.dataSources;
  const dsConfig = dataSources[rulesSourceName]?.result;
  if (!dsConfig) {
    throw new Error(`Data source configuration is not available for "${rulesSourceName}" data source`);
  }

  return dsConfig;
}

function getDataSourceRulerConfig(getState: () => unknown, rulesSourceName: string) {
  const dsConfig = getDataSourceConfig(getState, rulesSourceName);
  if (!dsConfig.rulerConfig) {
    throw new Error(`Ruler API is not available for ${rulesSourceName}`);
  }

  return dsConfig.rulerConfig;
}

export const fetchPromRulesAction = createAsyncThunk(
  'unifiedalerting/fetchPromRules',
  async (
    { rulesSourceName, filter }: { rulesSourceName: string; filter?: FetchPromRulesFilter },
    thunkAPI
  ): Promise<RuleNamespace[]> => {
    await thunkAPI.dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
    return await withSerializedError(fetchRules(rulesSourceName, filter));
  }
);

export const fetchAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/fetchAmConfig',
  (alertManagerSourceName: string): Promise<AlertManagerCortexConfig> =>
    withSerializedError(
      (async () => {
        // for vanilla prometheus, there is no config endpoint. Only fetch config from status
        if (isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName)) {
          return fetchStatus(alertManagerSourceName).then((status) => ({
            alertmanager_config: status.config,
            template_files: {},
          }));
        }

        return retryWhile(
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
              template_file_provenances: result.template_file_provenances,
            }));
          }
          return result;
        });
      })()
    )
);

export const fetchExternalAlertmanagersAction = createAsyncThunk(
  'unifiedAlerting/fetchExternalAlertmanagers',
  (): Promise<ExternalAlertmanagersResponse> => {
    return withSerializedError(fetchExternalAlertmanagers());
  }
);

export const fetchExternalAlertmanagersConfigAction = createAsyncThunk(
  'unifiedAlerting/fetchExternAlertmanagersConfig',
  (): Promise<ExternalAlertmanagerConfig> => {
    return withSerializedError(fetchExternalAlertmanagerConfig());
  }
);

export const fetchRulerRulesAction = createAsyncThunk(
  'unifiedalerting/fetchRulerRules',
  async (
    {
      rulesSourceName,
      filter,
    }: {
      rulesSourceName: string;
      filter?: FetchRulerRulesFilter;
    },
    { dispatch, getState }
  ): Promise<RulerRulesConfigDTO | null> => {
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, rulesSourceName);
    return await withSerializedError(fetchRulerRules(rulerConfig, filter));
  }
);

export function fetchPromAndRulerRulesAction({ rulesSourceName }: { rulesSourceName: string }): ThunkResult<void> {
  return async (dispatch, getState) => {
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
    const dsConfig = getDataSourceConfig(getState, rulesSourceName);

    await dispatch(fetchPromRulesAction({ rulesSourceName }));
    if (dsConfig.rulerConfig) {
      await dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }
  };
}

export const fetchSilencesAction = createAsyncThunk(
  'unifiedalerting/fetchSilences',
  (alertManagerSourceName: string): Promise<Silence[]> => {
    return withSerializedError(fetchSilences(alertManagerSourceName));
  }
);

// this will only trigger ruler rules fetch if rules are not loaded yet and request is not in flight
export function fetchRulerRulesIfNotFetchedYet(rulesSourceName: string): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { rulerRules } = getStore().unifiedAlerting;
    const resp = rulerRules[rulesSourceName];
    if (!resp?.result && !(resp && isRulerNotSupportedResponse(resp)) && !resp?.loading) {
      dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }
  };
}

export function fetchAllPromBuildInfoAction(): ThunkResult<Promise<void>> {
  return async (dispatch) => {
    const allRequests = getAllRulesSourceNames().map((rulesSourceName) =>
      dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }))
    );

    await Promise.allSettled(allRequests);
  };
}

export const fetchRulesSourceBuildInfoAction = createAsyncThunk(
  'unifiedalerting/fetchPromBuildinfo',
  async ({ rulesSourceName }: { rulesSourceName: string }): Promise<PromBasedDataSource> => {
    return withSerializedError<PromBasedDataSource>(
      (async (): Promise<PromBasedDataSource> => {
        if (rulesSourceName === GRAFANA_RULES_SOURCE_NAME) {
          return {
            name: GRAFANA_RULES_SOURCE_NAME,
            id: GRAFANA_RULES_SOURCE_NAME,
            rulerConfig: {
              dataSourceName: GRAFANA_RULES_SOURCE_NAME,
              apiVersion: 'legacy',
            },
          };
        }

        const ds = getRulesDataSource(rulesSourceName);
        if (!ds) {
          throw new Error(`Missing data source configuration for ${rulesSourceName}`);
        }

        const { id, name } = ds;
        const buildInfo = await discoverFeatures(name);

        const rulerConfig: RulerDataSourceConfig | undefined = buildInfo.features.rulerApiEnabled
          ? {
              dataSourceName: name,
              apiVersion: buildInfo.application === PromApplication.Lotex ? 'legacy' : 'config',
            }
          : undefined;

        return {
          name: name,
          id: id,
          rulerConfig,
        };
      })()
    );
  },
  {
    condition: ({ rulesSourceName }, { getState }) => {
      const dataSources: AsyncRequestMapSlice<PromBasedDataSource> = (getState() as StoreState).unifiedAlerting
        .dataSources;
      const hasLoaded = Boolean(dataSources[rulesSourceName]?.result);
      return !hasLoaded;
    },
  }
);

export function fetchAllPromAndRulerRulesAction(force = false): ThunkResult<void> {
  return async (dispatch, getStore) => {
    await dispatch(fetchAllPromBuildInfoAction());

    const { promRules, rulerRules, dataSources } = getStore().unifiedAlerting;

    getAllRulesSourceNames().map((rulesSourceName) => {
      const dataSourceConfig = dataSources[rulesSourceName].result;
      if (!dataSourceConfig) {
        return;
      }

      if (force || !promRules[rulesSourceName]?.loading) {
        dispatch(fetchPromRulesAction({ rulesSourceName }));
      }
      if ((force || !rulerRules[rulesSourceName]?.loading) && dataSourceConfig.rulerConfig) {
        dispatch(fetchRulerRulesAction({ rulesSourceName }));
      }
    });
  };
}

export function fetchAllPromRulesAction(force = false): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const { promRules } = getStore().unifiedAlerting;
    getAllRulesSourceNames().map((rulesSourceName) => {
      if (force || !promRules[rulesSourceName]?.loading) {
        dispatch(fetchPromRulesAction({ rulesSourceName }));
      }
    });
  };
}

export const fetchEditableRuleAction = createAsyncThunk(
  'unifiedalerting/fetchEditableRule',
  (ruleIdentifier: RuleIdentifier, thunkAPI): Promise<RuleWithLocation | null> => {
    const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, ruleIdentifier.ruleSourceName);
    return withSerializedError(getRulerClient(rulerConfig).findEditableRule(ruleIdentifier));
  }
);

export function deleteRulesGroupAction(
  namespace: CombinedRuleNamespace,
  ruleGroup: CombinedRuleGroup
): ThunkResult<void> {
  return async (dispatch, getState) => {
    withAppEvents(
      (async () => {
        const sourceName = getRulesSourceName(namespace.rulesSource);
        const rulerConfig = getDataSourceRulerConfig(getState, sourceName);

        await deleteRulerRulesGroup(rulerConfig, namespace.name, ruleGroup.name);
        await dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: sourceName }));
      })(),
      { successMessage: 'Group deleted' }
    );
  };
}

export function deleteRuleAction(
  ruleIdentifier: RuleIdentifier,
  options: { navigateTo?: string } = {}
): ThunkResult<void> {
  /*
   * fetch the rules group from backend, delete group if it is found and+
   * reload ruler rules
   */
  return async (dispatch, getState) => {
    withAppEvents(
      (async () => {
        const rulerConfig = getDataSourceRulerConfig(getState, ruleIdentifier.ruleSourceName);
        const rulerClient = getRulerClient(rulerConfig);
        const ruleWithLocation = await rulerClient.findEditableRule(ruleIdentifier);

        if (!ruleWithLocation) {
          throw new Error('Rule not found.');
        }
        await rulerClient.deleteRule(ruleWithLocation);
        // refetch rules for this rules source
        await dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: ruleWithLocation.ruleSourceName }));

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

export const saveRuleFormAction = createAsyncThunk(
  'unifiedalerting/saveRuleForm',
  (
    {
      values,
      existing,
      redirectOnSave,
    }: {
      values: RuleFormValues;
      existing?: RuleWithLocation;
      redirectOnSave?: string;
    },
    thunkAPI
  ): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          const { type } = values;

          // TODO getRulerConfig should be smart enough to provide proper rulerClient implementation
          // For the dataSourceName specified
          // in case of system (cortex/loki)
          let identifier: RuleIdentifier;
          if (type === RuleFormType.cloudAlerting || type === RuleFormType.cloudRecording) {
            if (!values.dataSourceName) {
              throw new Error('The Data source has not been defined.');
            }
            const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, values.dataSourceName);
            const rulerClient = getRulerClient(rulerConfig);
            identifier = await rulerClient.saveLotexRule(values, existing);

            // in case of grafana managed
          } else if (type === RuleFormType.grafana) {
            const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, GRAFANA_RULES_SOURCE_NAME);
            const rulerClient = getRulerClient(rulerConfig);
            identifier = await rulerClient.saveGrafanaRule(values, existing);
          } else {
            throw new Error('Unexpected rule form type');
          }
          if (redirectOnSave) {
            locationService.push(redirectOnSave);
          } else {
            // if the identifier comes up empty (this happens when Grafana managed rule moves to another namespace or group)
            const stringifiedIdentifier = ruleId.stringifyIdentifier(identifier);
            if (!stringifiedIdentifier) {
              locationService.push('/alerting/list');
              return;
            }
            // redirect to edit page
            const newLocation = `/alerting/${encodeURIComponent(stringifiedIdentifier)}/edit`;
            if (locationService.getLocation().pathname !== newLocation) {
              locationService.replace(newLocation);
            } else {
              // refresh the details of the current editable rule after saving
              thunkAPI.dispatch(fetchEditableRuleAction(identifier));
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

export const fetchGrafanaAnnotationsAction = createAsyncThunk(
  'unifiedalerting/fetchGrafanaAnnotations',
  (alertId: string): Promise<StateHistoryItem[]> => withSerializedError(fetchAnnotations(alertId))
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
  (uid: string): Promise<FolderDTO> => withSerializedError((getBackendSrv() as any).getFolderByUid(uid))
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

export const deleteMuteTimingAction = (alertManagerSourceName: string, muteTimingName: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const config = getState().unifiedAlerting.amConfigs[alertManagerSourceName].result;

    const muteIntervals =
      config?.alertmanager_config?.mute_time_intervals?.filter(({ name }) => name !== muteTimingName) ?? [];

    if (config) {
      withAppEvents(
        dispatch(
          updateAlertManagerConfigAction({
            alertManagerSourceName,
            oldConfig: config,
            newConfig: {
              ...config,
              alertmanager_config: {
                ...config.alertmanager_config,
                route: config.alertmanager_config.route
                  ? removeMuteTimingFromRoute(muteTimingName, config.alertmanager_config?.route)
                  : undefined,
                mute_time_intervals: muteIntervals,
              },
            },
            refetch: true,
          })
        ),
        {
          successMessage: `Deleted "${muteTimingName}" from Alertmanager configuration`,
          errorMessage: 'Failed to delete mute timing',
        }
      );
    }
  };
};

interface TestReceiversOptions {
  alertManagerSourceName: string;
  receivers: Receiver[];
  alert?: TestReceiversAlert;
}

export const testReceiversAction = createAsyncThunk(
  'unifiedalerting/testReceivers',
  ({ alertManagerSourceName, receivers, alert }: TestReceiversOptions): Promise<void> => {
    return withAppEvents(withSerializedError(testReceivers(alertManagerSourceName, receivers, alert)), {
      errorMessage: 'Failed to send test alert.',
      successMessage: 'Test alert sent.',
    });
  }
);

interface UpdateNamespaceAndGroupOptions {
  rulesSourceName: string;
  namespaceName: string;
  groupName: string;
  newNamespaceName: string;
  newGroupName: string;
  groupInterval?: string;
}

// allows renaming namespace, renaming group and changing group interval, all in one go
export const updateLotexNamespaceAndGroupAction = createAsyncThunk(
  'unifiedalerting/updateLotexNamespaceAndGroup',
  async (options: UpdateNamespaceAndGroupOptions, thunkAPI): Promise<void> => {
    return withAppEvents(
      withSerializedError(
        (async () => {
          const { rulesSourceName, namespaceName, groupName, newNamespaceName, newGroupName, groupInterval } = options;
          if (options.rulesSourceName === GRAFANA_RULES_SOURCE_NAME) {
            throw new Error(`this action does not support Grafana rules`);
          }

          const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, rulesSourceName);
          // fetch rules and perform sanity checks
          const rulesResult = await fetchRulerRules(rulerConfig);
          if (!rulesResult[namespaceName]) {
            throw new Error(`Namespace "${namespaceName}" not found.`);
          }
          const existingGroup = rulesResult[namespaceName].find((group) => group.name === groupName);
          if (!existingGroup) {
            throw new Error(`Group "${groupName}" not found.`);
          }
          if (newGroupName !== groupName && !!rulesResult[namespaceName].find((group) => group.name === newGroupName)) {
            throw new Error(`Group "${newGroupName}" already exists.`);
          }
          if (newNamespaceName !== namespaceName && !!rulesResult[newNamespaceName]) {
            throw new Error(`Namespace "${newNamespaceName}" already exists.`);
          }
          if (
            newNamespaceName === namespaceName &&
            groupName === newGroupName &&
            groupInterval === existingGroup.interval
          ) {
            throw new Error('Nothing changed.');
          }

          // if renaming namespace - make new copies of all groups, then delete old namespace
          if (newNamespaceName !== namespaceName) {
            for (const group of rulesResult[namespaceName]) {
              await setRulerRuleGroup(
                rulerConfig,
                newNamespaceName,
                group.name === groupName
                  ? {
                      ...group,
                      name: newGroupName,
                      interval: groupInterval,
                    }
                  : group
              );
            }
            await deleteNamespace(rulerConfig, namespaceName);

            // if only modifying group...
          } else {
            // save updated group
            await setRulerRuleGroup(rulerConfig, namespaceName, {
              ...existingGroup,
              name: newGroupName,
              interval: groupInterval,
            });
            // if group name was changed, delete old group
            if (newGroupName !== groupName) {
              await deleteRulerRulesGroup(rulerConfig, namespaceName, groupName);
            }
          }

          // refetch all rules
          await thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName }));
        })()
      ),
      {
        errorMessage: 'Failed to update namespace / group',
        successMessage: 'Update successful',
      }
    );
  }
);

export const addExternalAlertmanagersAction = createAsyncThunk(
  'unifiedAlerting/addExternalAlertmanagers',
  async (alertmanagerConfig: ExternalAlertmanagerConfig, thunkAPI): Promise<void> => {
    return withAppEvents(
      withSerializedError(
        (async () => {
          await addAlertManagers(alertmanagerConfig);
          thunkAPI.dispatch(fetchExternalAlertmanagersConfigAction());
        })()
      ),
      {
        errorMessage: 'Failed adding alertmanagers',
        successMessage: 'Alertmanagers updated',
      }
    );
  }
);
