import { createAsyncThunk } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';

import { locationService, logMeasurement } from '@grafana/runtime';
import {
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  Matcher,
  Receiver,
  TestReceiversAlert,
} from 'app/plugins/datasource/alertmanager/types';
import { ThunkResult } from 'app/types';
import { RuleIdentifier, RuleNamespace, StateHistoryItem } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { withPromRulesMetadataLogging, withRulerRulesMetadataLogging } from '../Analytics';
import {
  deleteAlertManagerConfig,
  fetchAlertGroups,
  testReceivers,
  updateAlertManagerConfig,
} from '../api/alertmanager';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { fetchAnnotations } from '../api/annotations';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { FetchPromRulesFilter, fetchRules } from '../api/prometheus';
import { FetchRulerRulesFilter, fetchRulerRules } from '../api/ruler';
import { addDefaultsToAlertmanagerConfig } from '../utils/alertmanager';
import { getAllRulesSourceNames } from '../utils/datasource';
import { makeAMLink } from '../utils/misc';
import { withAppEvents, withSerializedError } from '../utils/redux';
import { getAlertInfo } from '../utils/rules';
import { safeParsePrometheusDuration } from '../utils/time';

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
    const { data: dsFeatures } = await dispatch(
      featureDiscoveryApi.endpoints.discoverDsFeatures.initiate({ rulesSourceName })
    );

    if (!dsFeatures?.rulerConfig) {
      return null;
    }

    const fetchRulerRulesWithLogging = withRulerRulesMetadataLogging(
      'unifiedalerting/fetchRulerRules',
      fetchRulerRules,
      {
        dataSourceName: rulesSourceName,
        thunk: 'unifiedalerting/fetchRulerRules',
      }
    );

    return await withSerializedError(fetchRulerRulesWithLogging(dsFeatures.rulerConfig, filter));
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
  return async (dispatch) => {
    const { data: dsFeatures } = await dispatch(
      featureDiscoveryApi.endpoints.discoverDsFeatures.initiate({ rulesSourceName })
    );

    await Promise.all([
      dispatch(fetchPromRulesAction({ rulesSourceName, identifier, filter, limitAlerts, matcher, state })),
      dsFeatures?.rulerConfig ? dispatch(fetchRulerRulesAction({ rulesSourceName })) : Promise.resolve(),
    ]);
  };
}

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
        const { data: dsFeatures } = await dispatch(
          featureDiscoveryApi.endpoints.discoverDsFeatures.initiate({ rulesSourceName })
        );

        const { promRules, rulerRules } = getStore().unifiedAlerting;

        if (!dsFeatures) {
          return;
        }

        const shouldLoadProm = force || !promRules[rulesSourceName]?.loading;
        const shouldLoadRuler = (force || !rulerRules[rulesSourceName]?.loading) && Boolean(dsFeatures?.rulerConfig);

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
  (ruleUID: string): Promise<StateHistoryItem[]> => withSerializedError(fetchAnnotations(ruleUID))
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
