import { createAsyncThunk } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';

import { locationService } from '@grafana/runtime';
import { logMeasurement } from '@grafana/runtime/src/utils/logging';
import {
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  Matcher,
  Receiver,
  TestReceiversAlert,
} from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO, NotifierDTO, StoreState, ThunkResult } from 'app/types';
import {
  CombinedRuleGroup,
  CombinedRuleNamespace,
  PromBasedDataSource,
  RuleIdentifier,
  RuleNamespace,
  RuleWithLocation,
  RulerDataSourceConfig,
  StateHistoryItem,
} from 'app/types/unified-alerting';
import {
  PostableRulerRuleGroupDTO,
  PromApplication,
  RulerRuleDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import { backendSrv } from '../../../../core/services/backend_srv';
import {
  LogMessages,
  logError,
  logInfo,
  trackSwitchToPoliciesRouting,
  trackSwitchToSimplifiedRouting,
  withPerformanceLogging,
  withPromRulesMetadataLogging,
  withRulerRulesMetadataLogging,
} from '../Analytics';
import { alertRuleApi } from '../api/alertRuleApi';
import {
  deleteAlertManagerConfig,
  fetchAlertGroups,
  testReceivers,
  updateAlertManagerConfig,
} from '../api/alertmanager';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { fetchAnnotations } from '../api/annotations';
import { discoverFeatures } from '../api/buildInfo';
import { fetchNotifiers } from '../api/grafana';
import { FetchPromRulesFilter, fetchRules } from '../api/prometheus';
import { FetchRulerRulesFilter, deleteRulerRulesGroup, fetchRulerRules, setRulerRuleGroup } from '../api/ruler';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { addDefaultsToAlertmanagerConfig, removeMuteTimingFromRoute } from '../utils/alertmanager';
import {
  GRAFANA_RULES_SOURCE_NAME,
  getAllRulesSourceNames,
  getRulesDataSource,
  getRulesSourceName,
} from '../utils/datasource';
import { makeAMLink } from '../utils/misc';
import { AsyncRequestMapSlice, withAppEvents, withSerializedError } from '../utils/redux';
import * as ruleId from '../utils/rule-id';
import { getRulerClient } from '../utils/rulerClient';
import { getAlertInfo, isGrafanaRulerRule, isRulerNotSupportedResponse } from '../utils/rules';
import { safeParsePrometheusDuration } from '../utils/time';

function getDataSourceConfig(getState: () => unknown, rulesSourceName: string) {
  const dataSources = (getState() as StoreState).unifiedAlerting.dataSources;
  const dsConfig = dataSources[rulesSourceName]?.result;
  const dsError = dataSources[rulesSourceName]?.error;

  // @TODO use aggregateError but add support for it in "stringifyErrorLike"
  if (!dsConfig) {
    const error = new Error(`Data source configuration is not available for "${rulesSourceName}" data source`);
    if (dsError) {
      error.cause = dsError;
    }

    throw error;
  }

  return dsConfig;
}

export function getDataSourceRulerConfig(getState: () => unknown, rulesSourceName: string) {
  const dsConfig = getDataSourceConfig(getState, rulesSourceName);
  if (!dsConfig.rulerConfig) {
    throw new Error(`Ruler API is not available for ${rulesSourceName}`);
  }

  return dsConfig.rulerConfig;
}

export const fetchPromRulesAction = createAsyncThunk(
  'unifiedalerting/fetchPromRules',
  async (
    {
      rulesSourceName,
      filter,
      limitAlerts,
      matcher,
      state,
      identifier,
    }: {
      rulesSourceName: string;
      filter?: FetchPromRulesFilter;
      limitAlerts?: number;
      matcher?: Matcher[];
      state?: string[];
      identifier?: RuleIdentifier;
    },
    thunkAPI
  ): Promise<RuleNamespace[]> => {
    await thunkAPI.dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));

    const fetchRulesWithLogging = withPromRulesMetadataLogging('unifiedalerting/fetchPromRules', fetchRules, {
      dataSourceName: rulesSourceName,
      thunk: 'unifiedalerting/fetchPromRules',
    });

    return await withSerializedError(
      fetchRulesWithLogging(rulesSourceName, filter, limitAlerts, matcher, state, identifier)
    );
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

    const fetchRulerRulesWithLogging = withRulerRulesMetadataLogging(
      'unifiedalerting/fetchRulerRules',
      fetchRulerRules,
      {
        dataSourceName: rulesSourceName,
        thunk: 'unifiedalerting/fetchRulerRules',
      }
    );

    return await withSerializedError(fetchRulerRulesWithLogging(rulerConfig, filter));
  }
);

export function fetchPromAndRulerRulesAction({
  rulesSourceName,
  identifier,
  filter,
  limitAlerts,
  matcher,
  state,
}: {
  rulesSourceName: string;
  identifier?: RuleIdentifier;
  filter?: FetchPromRulesFilter;
  limitAlerts?: number;
  matcher?: Matcher[];
  state?: string[];
}): ThunkResult<Promise<void>> {
  return async (dispatch, getState) => {
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
    const dsConfig = getDataSourceConfig(getState, rulesSourceName);

    await dispatch(fetchPromRulesAction({ rulesSourceName, identifier, filter, limitAlerts, matcher, state }));
    if (dsConfig.rulerConfig) {
      await dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }
  };
}

// this will only trigger ruler rules fetch if rules are not loaded yet and request is not in flight
export function fetchRulerRulesIfNotFetchedYet(rulesSourceName: string): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { rulerRules } = getStore().unifiedAlerting;
    const resp = rulerRules[rulesSourceName];
    const emptyResults = isEmpty(resp?.result);
    if (emptyResults && !(resp && isRulerNotSupportedResponse(resp)) && !resp?.loading) {
      dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }
  };
}

// TODO: memoize this or move to RTK Query so we can cache results!
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

        const discoverFeaturesWithLogging = withPerformanceLogging(
          'unifiedalerting/fetchPromBuildinfo',
          discoverFeatures,
          {
            dataSourceName: rulesSourceName,
            thunk: 'unifiedalerting/fetchPromBuildinfo',
          }
        );

        const buildInfo = await discoverFeaturesWithLogging(name);

        const rulerConfig: RulerDataSourceConfig | undefined = buildInfo.features.rulerApiEnabled
          ? {
              dataSourceName: name,
              apiVersion: buildInfo.application === PromApplication.Cortex ? 'legacy' : 'config',
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
      const hasError = Boolean(dataSources[rulesSourceName]?.error);

      return !(hasLoaded || hasError);
    },
  }
);

interface FetchPromRulesRulesActionProps {
  filter?: FetchPromRulesFilter;
  limitAlerts?: number;
  matcher?: Matcher[];
  state?: string[];
}

export function fetchAllPromAndRulerRulesAction(
  force = false,
  options: FetchPromRulesRulesActionProps = {}
): ThunkResult<Promise<void>> {
  return async (dispatch, getStore) => {
    const allStartLoadingTs = performance.now();

    await Promise.allSettled(
      getAllRulesSourceNames().map(async (rulesSourceName) => {
        await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));

        const { promRules, rulerRules, dataSources } = getStore().unifiedAlerting;
        const dataSourceConfig = dataSources[rulesSourceName].result;

        if (!dataSourceConfig) {
          return;
        }

        const shouldLoadProm = force || !promRules[rulesSourceName]?.loading;
        const shouldLoadRuler =
          (force || !rulerRules[rulesSourceName]?.loading) && Boolean(dataSourceConfig.rulerConfig);

        await Promise.allSettled([
          shouldLoadProm && dispatch(fetchPromRulesAction({ rulesSourceName, ...options })),
          shouldLoadRuler && dispatch(fetchRulerRulesAction({ rulesSourceName })),
        ]);
      })
    );

    logMeasurement('unifiedalerting/fetchAllPromAndRulerRulesAction', {
      loadTimeMs: performance.now() - allStartLoadingTs,
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

export const saveRuleFormAction = createAsyncThunk(
  'unifiedalerting/saveRuleForm',
  (
    {
      values,
      existing,
      redirectOnSave,
      evaluateEvery,
    }: {
      values: RuleFormValues;
      existing?: RuleWithLocation;
      redirectOnSave?: string;
      initialAlertRuleName?: string;
      evaluateEvery: string;
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
            identifier = await rulerClient.saveLotexRule(values, evaluateEvery, existing);
            await thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName: values.dataSourceName }));
            // in case of grafana managed
          } else if (type === RuleFormType.grafana) {
            const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, GRAFANA_RULES_SOURCE_NAME);
            const rulerClient = getRulerClient(rulerConfig);
            identifier = await rulerClient.saveGrafanaRule(values, evaluateEvery, existing);
            reportSwitchingRoutingType(values, existing);
            // when using a Granfa-managed alert rule we can invalidate a single rule
            thunkAPI.dispatch(alertRuleApi.util.invalidateTags([{ type: 'GrafanaRulerRule', id: identifier.uid }]));
          } else {
            throw new Error('Unexpected rule form type');
          }

          logInfo(LogMessages.successSavingAlertRule, { type, isNew: (!existing).toString() });

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

function reportSwitchingRoutingType(values: RuleFormValues, existingRule: RuleWithLocation<RulerRuleDTO> | undefined) {
  // track if the user switched from simplified routing to policies routing or vice versa
  if (isGrafanaRulerRule(existingRule?.rule)) {
    const ga = existingRule?.rule.grafana_alert;
    const existingWasUsingSimplifiedRouting = Boolean(ga?.notification_settings?.receiver);
    const newValuesUsesSimplifiedRouting = values.manualRouting;
    const shouldTrackSwitchToSimplifiedRouting = !existingWasUsingSimplifiedRouting && newValuesUsesSimplifiedRouting;
    const shouldTrackSwitchToPoliciesRouting = existingWasUsingSimplifiedRouting && !newValuesUsesSimplifiedRouting;

    if (shouldTrackSwitchToSimplifiedRouting) {
      trackSwitchToSimplifiedRouting();
    }
    if (shouldTrackSwitchToPoliciesRouting) {
      trackSwitchToPoliciesRouting();
    }
  }
}

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
  redirectSearch?: string; // additional redirect query params
}

export const updateAlertManagerConfigAction = createAsyncThunk<void, UpdateAlertManagerConfigActionOptions, {}>(
  'unifiedalerting/updateAMConfig',
  (
    { alertManagerSourceName, oldConfig, newConfig, successMessage, redirectPath, redirectSearch },
    thunkAPI
  ): Promise<void> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          const latestConfig = await thunkAPI
            .dispatch(
              alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName, {
                forceRefetch: true,
              })
            )
            .unwrap();

          const isLatestConfigEmpty = isEmpty(latestConfig.alertmanager_config) && isEmpty(latestConfig.template_files);
          const oldLastConfigsDiffer = JSON.stringify(latestConfig) !== JSON.stringify(oldConfig);

          if (!isLatestConfigEmpty && oldLastConfigsDiffer) {
            throw new Error(
              'A newer Alertmanager configuration is available. Please reload the page and try again to not overwrite recent changes.'
            );
          }
          await updateAlertManagerConfig(alertManagerSourceName, addDefaultsToAlertmanagerConfig(newConfig));
          thunkAPI.dispatch(alertmanagerApi.util.invalidateTags(['AlertmanagerConfiguration']));
          if (redirectPath) {
            const options = new URLSearchParams(redirectSearch ?? '');
            locationService.push(makeAMLink(redirectPath, alertManagerSourceName, options));
          }
        })()
      ),
      {
        successMessage,
      }
    )
);

export const deleteReceiverAction = (receiverName: string, alertManagerSourceName: string): ThunkResult<void> => {
  return async (dispatch) => {
    const config = await dispatch(
      alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName)
    ).unwrap();

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
      })
    );
  };
};

export const deleteTemplateAction = (templateName: string, alertManagerSourceName: string): ThunkResult<void> => {
  return async (dispatch) => {
    const config = await dispatch(
      alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName)
    ).unwrap();

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
      })
    );
  };
};

export const fetchFolderAction = createAsyncThunk(
  'unifiedalerting/fetchFolder',
  (uid: string): Promise<FolderDTO> => withSerializedError(backendSrv.getFolderByUid(uid, { withAccessControl: true }))
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
          await thunkAPI.dispatch(alertmanagerApi.util.invalidateTags(['AlertmanagerConfiguration']));
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
  return async (dispatch) => {
    const config = await dispatch(
      alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName)
    ).unwrap();

    const isGrafanaDatasource = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;

    const muteIntervalsFiltered =
      (config?.alertmanager_config?.mute_time_intervals ?? [])?.filter(({ name }) => name !== muteTimingName) ?? [];
    const timeIntervalsFiltered =
      (config?.alertmanager_config?.time_intervals ?? [])?.filter(({ name }) => name !== muteTimingName) ?? [];

    const time_intervals_without_mute_to_save = isGrafanaDatasource
      ? {
          mute_time_intervals: [...muteIntervalsFiltered, ...timeIntervalsFiltered],
        }
      : {
          time_intervals: timeIntervalsFiltered,
          mute_time_intervals: muteIntervalsFiltered,
        };

    if (config) {
      const { mute_time_intervals: _, ...configWithoutMuteTimings } = config?.alertmanager_config ?? {};
      withAppEvents(
        dispatch(
          updateAlertManagerConfigAction({
            alertManagerSourceName,
            oldConfig: config,
            newConfig: {
              ...config,
              alertmanager_config: {
                ...configWithoutMuteTimings,
                route: config.alertmanager_config.route
                  ? removeMuteTimingFromRoute(muteTimingName, config.alertmanager_config?.route)
                  : undefined,
                ...time_intervals_without_mute_to_save,
              },
            },
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

export const rulesInSameGroupHaveInvalidFor = (rules: RulerRuleDTO[], everyDuration: string) => {
  return rules.filter((rule: RulerRuleDTO) => {
    const { forDuration } = getAlertInfo(rule, everyDuration);
    const forNumber = safeParsePrometheusDuration(forDuration);
    const everyNumber = safeParsePrometheusDuration(everyDuration);

    return forNumber !== 0 && forNumber < everyNumber;
  });
};

interface UpdateRulesOrderOptions {
  rulesSourceName: string;
  namespaceName: string;
  groupName: string;
  newRules: RulerRuleDTO[];
  folderUid: string;
}

export const updateRulesOrder = createAsyncThunk(
  'unifiedalerting/updateRulesOrderForGroup',
  async (options: UpdateRulesOrderOptions, thunkAPI): Promise<void> => {
    return withAppEvents(
      withSerializedError(
        (async () => {
          const { rulesSourceName, namespaceName, groupName, newRules, folderUid } = options;

          const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, rulesSourceName);
          const rulesResult = await fetchRulerRules(rulerConfig);

          const existingGroup = rulesResult[namespaceName].find((group) => group.name === groupName);
          if (!existingGroup) {
            throw new Error(`Group "${groupName}" not found.`);
          }

          // We're unlikely to have this happen, as any user of this action should have already ensured
          // that the entire group was fetched before sending a new order.
          // But as a final safeguard we should fail if we somehow ended up here with a mismatched rules count
          // This would indicate an accidental deletion of rules following a frontend bug
          if (existingGroup.rules.length !== newRules.length) {
            const err = new Error('Rules count mismatch. Please refresh the page and try again.');
            logError(err, { namespaceName, groupName });
            throw err;
          }

          const payload: PostableRulerRuleGroupDTO = {
            name: existingGroup.name,
            interval: existingGroup.interval,
            rules: newRules,
          };

          await setRulerRuleGroup(rulerConfig, folderUid ?? namespaceName, payload);

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
