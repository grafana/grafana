import { produce } from 'immer';
import { useEffect } from 'react';

import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { timeIntervalsApi } from 'app/features/alerting/unified/api/timeIntervalsApi';
import { mergeTimeIntervals } from 'app/features/alerting/unified/components/mute-timings/util';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval,
  ReadNamespacedTimeIntervalApiResponse,
} from 'app/features/alerting/unified/openapi/timeIntervalsApi.gen';
import { deleteMuteTimingAction, updateAlertManagerConfigAction } from 'app/features/alerting/unified/state/actions';
import { BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { renameMuteTimings } from 'app/features/alerting/unified/utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { PROVENANCE_ANNOTATION, PROVENANCE_NONE } from 'app/features/alerting/unified/utils/k8s/constants';
import { getK8sNamespace, shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
const {
  useLazyListNamespacedTimeIntervalQuery,
  useCreateNamespacedTimeIntervalMutation,
  useLazyReadNamespacedTimeIntervalQuery,
  useReplaceNamespacedTimeIntervalMutation,
  useDeleteNamespacedTimeIntervalMutation,
} = timeIntervalsApi;

/**
 * Alertmanager mute time interval, with optional additional metadata
 * (returned in the case of K8S API implementation)
 * */
export type MuteTiming = MuteTimeInterval & {
  id: string;
  metadata?: ReadNamespacedTimeIntervalApiResponse['metadata'];
};

/** Alias for generated kuberenetes Alerting API Server type */
type TimeIntervalV0Alpha1 = ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval;

/** Parse kubernetes API response into a Mute Timing */
const parseK8sTimeInterval: (item: TimeIntervalV0Alpha1) => MuteTiming = (item) => {
  const { metadata, spec } = item;
  return {
    ...spec,
    id: spec.name,
    metadata,
    provisioned: metadata.annotations?.[PROVENANCE_ANNOTATION] !== PROVENANCE_NONE,
  };
};

/** Parse Alertmanager time interval response into a Mute Timing */
const parseAmTimeInterval: (interval: MuteTimeInterval, provenance: string) => MuteTiming = (interval, provenance) => {
  return {
    ...interval,
    id: interval.name,
    provisioned: Boolean(provenance && provenance !== PROVENANCE_NONE),
  };
};

const useAlertmanagerIntervals = () =>
  useLazyGetAlertmanagerConfigurationQuery({
    selectFromResult: ({ data, ...rest }) => {
      if (!data) {
        return { data, ...rest };
      }
      const { alertmanager_config } = data;
      const muteTimingsProvenances = alertmanager_config.muteTimeProvenances ?? {};
      const intervals = mergeTimeIntervals(alertmanager_config);
      const timeIntervals = intervals.map((interval) =>
        parseAmTimeInterval(interval, muteTimingsProvenances[interval.name])
      );

      return {
        data: timeIntervals,
        ...rest,
      };
    },
  });

const useGrafanaAlertmanagerIntervals = () =>
  useLazyListNamespacedTimeIntervalQuery({
    selectFromResult: ({ data, ...rest }) => {
      return {
        data: data?.items.map((item) => parseK8sTimeInterval(item)),
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
      const namespace = getK8sNamespace();
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
  const [createGrafanaTimeInterval] = useCreateNamespacedTimeIntervalMutation();
  const [getAlertmanagerConfig] = useLazyGetAlertmanagerConfigurationQuery();

  const isGrafanaAm = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  if (useK8sApi) {
    const namespace = getK8sNamespace();
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
      draft.alertmanager_config[propertyToUpdate] = (draft.alertmanager_config[propertyToUpdate] ?? []).concat(
        timeInterval
      );
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

  const [getGrafanaTimeInterval, k8sResponse] = useLazyReadNamespacedTimeIntervalQuery({
    selectFromResult: ({ data, ...rest }) => {
      if (!data) {
        return { data, ...rest };
      }

      return {
        data: parseK8sTimeInterval(data),
        ...rest,
      };
    },
  });

  const [getAlertmanagerTimeInterval, amConfigApiResponse] = useLazyGetAlertmanagerConfigurationQuery({
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
          data: parseAmTimeInterval(timing, muteTimingsProvenances[timing.name]),
          ...rest,
        };
      }
      return { ...rest, data: undefined, isError: true };
    },
  });

  useEffect(() => {
    if (useK8sApi) {
      const namespace = getK8sNamespace();
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
  const [replaceGrafanaTimeInterval] = useReplaceNamespacedTimeIntervalMutation();
  const [getAlertmanagerConfig] = useLazyGetAlertmanagerConfigurationQuery();

  if (useK8sApi) {
    return async ({ timeInterval, originalName }: { timeInterval: MuteTimeInterval; originalName: string }) => {
      const namespace = getK8sNamespace();
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
  const [deleteGrafanaTimeInterval] = useDeleteNamespacedTimeIntervalMutation();

  if (useK8sApi) {
    return async ({ name }: { name: string }) => {
      const namespace = getK8sNamespace();
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
