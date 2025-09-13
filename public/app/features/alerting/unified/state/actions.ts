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
import { FolderDTO, StoreState, ThunkResult } from 'app/types';
import {
  PromBasedDataSource,
  RuleIdentifier,
  RuleNamespace,
  RulerDataSourceConfig,
  StateHistoryItem,
} from 'app/types/unified-alerting';
import { PromApplication, RulerRuleDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { backendSrv } from '../../../../core/services/backend_srv';
import { withPerformanceLogging, withPromRulesMetadataLogging, withRulerRulesMetadataLogging } from '../Analytics';
import {
  deleteAlertManagerConfig,
  fetchAlertGroups,
  testReceivers,
  updateAlertManagerConfig,
} from '../api/alertmanager';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { fetchAnnotations } from '../api/annotations';
import { discoverFeatures } from '../api/buildInfo';
import { FetchPromRulesFilter, fetchRules } from '../api/prometheus';
import { FetchRulerRulesFilter, fetchRulerRules } from '../api/ruler';
import { addDefaultsToAlertmanagerConfig } from '../utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME, getAllRulesSourceNames, getRulesDataSource } from '../utils/datasource';
import { makeAMLink } from '../utils/misc';
import { AsyncRequestMapSlice, withAppEvents, withSerializedError } from '../utils/redux';
import { getAlertInfo } from '../utils/rules';
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
  options: FetchPromRulesRulesActionProps = {},
  dataSourceNameBlocklist: string[] = [],
): ThunkResult<Promise<void>> {
  return async (dispatch, getStore) => {
    const allStartLoadingTs = performance.now();
    const dataSourceNames =
      getAllRulesSourceNames()
        .filter((name) => !dataSourceNameBlocklist.includes(name));

    await Promise.allSettled(
      dataSourceNames.map(async (rulesSourceName) => {
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

export function fetchAllPromRulesAction(
  force = false,
  options: FetchPromRulesRulesActionProps = {}
): ThunkResult<Promise<void>> {
  return async (dispatch, getStore) => {
    const { promRules } = getStore().unifiedAlerting;
    getAllRulesSourceNames().map((rulesSourceName) => {
      if (force || !promRules[rulesSourceName]?.loading) {
        dispatch(fetchPromRulesAction({ rulesSourceName, ...options }));
      }
    });
  };
}

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
          thunkAPI.dispatch(
            alertmanagerApi.util.invalidateTags([
              'AlertmanagerConfiguration',
              'ContactPoint',
              'ContactPointsStatus',
              'Receiver',
            ])
          );
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
    const forNumber = forDuration ? safeParsePrometheusDuration(forDuration) : null;
    const everyNumber = safeParsePrometheusDuration(everyDuration);

    return forNumber ? forNumber !== 0 && forNumber < everyNumber : false;
  });
};
