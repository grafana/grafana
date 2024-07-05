import { produce } from 'immer';
import { useEffect } from 'react';

import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { timeIntervalsApi } from 'app/features/alerting/unified/api/timeIntervalsApi';
import {
  getNamespace,
  mergeTimeIntervals,
  shouldUseK8sApi,
} from 'app/features/alerting/unified/components/mute-timings/util';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval } from 'app/features/alerting/unified/openapi/timeIntervalsApi.gen';
import { deleteMuteTimingAction, updateAlertManagerConfigAction } from 'app/features/alerting/unified/state/actions';
import { renameMuteTimings } from 'app/features/alerting/unified/utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

type BaseAlertmanagerArgs = {
  /**
   * Name of alertmanager being used for mute timings management.
   *
   * Hooks will behave differently depending on whether this is `grafana` or an external alertmanager
   */
  alertmanager: string;
};

/** Name of the custom annotation label used in k8s APIs for us to discern if a given entity was provisioned */
export const PROVENANCE_ANNOTATION = 'grafana.com/provenance';

const parseTimeInterval = (item: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval) => {
  const { metadata, spec } = item;
  return {
    ...spec,
    id: metadata.uid || spec.name,
    metadata: metadata,
    provisioned: metadata.annotations?.[PROVENANCE_ANNOTATION] === 'file',
  };
};

const useAlertmanagerIntervals = () =>
  alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery({
    selectFromResult: ({ data, ...rest }) => {
      if (!data) {
        return { data, ...rest };
      }
      const { alertmanager_config } = data;
      const muteTimingsProvenances = alertmanager_config.muteTimeProvenances ?? {};
      const intervals = mergeTimeIntervals(alertmanager_config);
      const timeIntervals = intervals.map((interval) => ({
        ...interval,
        id: interval.name,
        provisioned: muteTimingsProvenances[interval.name] === 'file',
      }));

      return {
        data: timeIntervals,
        ...rest,
      };
    },
  });

const useGrafanaAlertmanagerIntervals = () =>
  timeIntervalsApi.endpoints.listNamespacedTimeInterval.useLazyQuery({
    selectFromResult: ({ data, ...rest }) => {
      return {
        data: data?.items.map((item) => parseTimeInterval(item)),
        ...rest,
      };
    },
  });

/**
 * Depending on alertmanager source, fetches mute timings.
 *
 * If the alertmanager source is Grafana, and `alertingApiServer` feature toggle is enabled,
 * fetches time intervals from k8s API.
 *
 * Otherwise, fetches and parses from the alertmanager config API
 */
export const useMuteTimings = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const [getGrafanaTimeIntervals, intervalsResponse] = useGrafanaAlertmanagerIntervals();
  const [getAlertmanagerTimeIntervals, configApiResponse] = useAlertmanagerIntervals();

  useEffect(() => {
    if (useK8sApi) {
      const namespace = getNamespace();
      getGrafanaTimeIntervals({ namespace });
    } else {
      getAlertmanagerTimeIntervals(alertmanager);
    }
  }, [alertmanager, getAlertmanagerTimeIntervals, getGrafanaTimeIntervals, useK8sApi]);
  return useK8sApi ? intervalsResponse : configApiResponse;
};

/**
 * Create a new mute timing.
 *
 * If the alertmanager source is Grafana, and `alertingApiServer` feature toggle is enabled,
 * fetches time intervals from k8s API.
 *
 * Otherwise, creates the new timing in `time_intervals` via AM config API
 */
export const useCreateMuteTiming = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const dispatch = useDispatch();
  const [createGrafanaTimeInterval] = timeIntervalsApi.endpoints.createNamespacedTimeInterval.useMutation();
  const [getAlertmanagerConfig] = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery();

  const isGrafanaAm = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  if (useK8sApi) {
    const namespace = getNamespace();
    return ({ timeInterval }: { timeInterval: MuteTimeInterval }) =>
      createGrafanaTimeInterval({
        namespace,
        comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval: { metadata: {}, spec: timeInterval },
      }).unwrap();
  }

  return async ({ timeInterval }: { timeInterval: MuteTimeInterval }) => {
    const result = await getAlertmanagerConfig(alertmanager).unwrap();
    const newConfig = produce(result, (draft) => {
      const propertyToUpdate = isGrafanaAm ? 'mute_time_intervals' : 'time_intervals';
      draft.alertmanager_config[propertyToUpdate] = draft.alertmanager_config[propertyToUpdate] ?? [];
      draft.alertmanager_config[propertyToUpdate]!.push(timeInterval);
    });

    return dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: result,
        alertManagerSourceName: alertmanager,
        successMessage: 'Mute timing saved',
      })
    ).unwrap();
  };
};

/**
 * Get an individual time interval, either from the k8s API,
 * or by finding it in the alertmanager config
 */
export const useGetMuteTiming = ({ alertmanager, name: nameToFind }: BaseAlertmanagerArgs & { name: string }) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const [getGrafanaTimeInterval, k8sResponse] = timeIntervalsApi.endpoints.readNamespacedTimeInterval.useLazyQuery({
    selectFromResult: ({ data, ...rest }) => {
      if (!data) {
        return { data, ...rest };
      }

      return {
        data: parseTimeInterval(data),
        ...rest,
      };
    },
  });

  const [getAlertmanagerTimeInterval, amConfigApiResponse] =
    alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery({
      selectFromResult: ({ data, ...rest }) => {
        if (!data) {
          return { data, ...rest };
        }
        const alertmanager_config = data?.alertmanager_config ?? {};
        const timeIntervals = mergeTimeIntervals(alertmanager_config);
        const timing = timeIntervals.find(({ name }) => name === nameToFind);
        if (timing) {
          const muteTimingsProvenances = alertmanager_config?.muteTimeProvenances ?? {};

          return {
            data: { ...timing, provisioned: muteTimingsProvenances[timing.name] === 'file' },
            ...rest,
          };
        }
        return { ...rest, data: undefined, isError: true };
      },
    });

  useEffect(() => {
    if (useK8sApi) {
      const namespace = getNamespace();
      getGrafanaTimeInterval({ namespace, name: nameToFind }, true);
    } else {
      getAlertmanagerTimeInterval(alertmanager, true);
    }
  }, [alertmanager, getAlertmanagerTimeInterval, getGrafanaTimeInterval, nameToFind, useK8sApi]);

  return useK8sApi ? k8sResponse : amConfigApiResponse;
};

/**
 * Updates an existing mute timing.
 *
 * If the alertmanager source is Grafana, and `alertingApiServer` feature toggle is enabled,
 * uses the k8s API. At the time of writing, the name of the timing cannot be changed via this API
 *
 * Otherwise, updates the timing via AM config API, and also ensures any referenced routes are updated
 */
export const useUpdateMuteTiming = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const dispatch = useDispatch();
  const [replaceGrafanaTimeInterval] = timeIntervalsApi.endpoints.replaceNamespacedTimeInterval.useMutation();
  const [getAlertmanagerConfig] = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery();

  if (useK8sApi) {
    return async ({ timeInterval, originalName }: { timeInterval: MuteTimeInterval; originalName: string }) => {
      const namespace = getNamespace();
      return replaceGrafanaTimeInterval({
        name: originalName,
        namespace,
        comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval: {
          spec: timeInterval,
          metadata: { name: originalName },
        },
      }).unwrap();
    };
  }

  return async ({ timeInterval, originalName }: { timeInterval: MuteTimeInterval; originalName: string }) => {
    const nameHasChanged = timeInterval.name !== originalName;
    const result = await getAlertmanagerConfig(alertmanager).unwrap();

    const newConfig = produce(result, (draft) => {
      const existingIntervalIndex = (draft.alertmanager_config?.time_intervals || [])?.findIndex(
        ({ name }) => name === originalName
      );
      if (existingIntervalIndex !== -1) {
        draft.alertmanager_config.time_intervals![existingIntervalIndex] = timeInterval;
      }

      const existingMuteIntervalIndex = (draft.alertmanager_config?.mute_time_intervals || [])?.findIndex(
        ({ name }) => name === originalName
      );
      if (existingMuteIntervalIndex !== -1) {
        draft.alertmanager_config.mute_time_intervals![existingMuteIntervalIndex] = timeInterval;
      }

      if (nameHasChanged && draft.alertmanager_config.route) {
        draft.alertmanager_config.route = renameMuteTimings(
          timeInterval.name,
          originalName,
          draft.alertmanager_config.route
        );
      }
    });

    return dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: result,
        alertManagerSourceName: alertmanager,
        successMessage: 'Mute timing saved',
      })
    ).unwrap();
  };
};

/**
 * Delete a mute timing interval
 */
export const useDeleteMuteTiming = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const dispatch = useDispatch();
  const [deleteGrafanaTimeInterval] = timeIntervalsApi.endpoints.deleteNamespacedTimeInterval.useMutation();

  if (useK8sApi) {
    return async ({ name }: { name: string }) => {
      const namespace = getNamespace();
      return deleteGrafanaTimeInterval({
        name,
        namespace,
        ioK8SApimachineryPkgApisMetaV1DeleteOptions: {},
      }).unwrap();
    };
  }

  return async ({ name }: { name: string }) => dispatch(deleteMuteTimingAction(alertmanager, name));
};

export const useValidateMuteTiming = ({ alertmanager }: BaseAlertmanagerArgs) => {
  const useK8sApi = shouldUseK8sApi(alertmanager);

  const [getIntervals] = useAlertmanagerIntervals();

  // If we're using the kubernetes API, then we let the API response handle the validation instead
  // as we don't expect to be able to fetch the intervals via the AM config
  if (useK8sApi) {
    return () => undefined;
  }

  return async (value: string, skipValidation?: boolean) => {
    if (skipValidation) {
      return;
    }
    return getIntervals(alertmanager)
      .unwrap()
      .then((config) => {
        const intervals = mergeTimeIntervals(config.alertmanager_config);
        const duplicatedInterval = Boolean(intervals?.find((interval) => interval.name === value));
        return duplicatedInterval ? `Mute timing already exists with name "${value}"` : undefined;
      });
  };
};
