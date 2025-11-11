/** @deprecated To be deleted - use alertingApiServer API instead */

import { ContactPointsState } from 'app/features/alerting/unified/types/alerting';
import { Receiver, TestReceiversAlert, TestReceiversResult } from 'app/plugins/datasource/alertmanager/types';

import { CONTACT_POINTS_STATE_INTERVAL_MS } from '../utils/constants';
import { getDatasourceAPIUid } from '../utils/datasource';

import { alertingApi } from './alertingApi';
import { fetchContactPointsState } from './grafana';

export const receiversApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    contactPointsState: build.query<ContactPointsState, { amSourceName: string }>({
      queryFn: async ({ amSourceName }) => {
        try {
          const contactPointsState = await fetchContactPointsState(amSourceName);
          return { data: contactPointsState };
        } catch (error) {
          return { error: error };
        }
      },
    }),
    testIntegration: build.mutation<TestReceiversResult, TestReceiversOptions>({
      query: ({ alertManagerSourceName, receivers, alert }) => ({
        method: 'POST',
        data: {
          receivers,
          alert,
        },
        url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/receivers/test`,
        showErrorAlert: false,
        showSuccessAlert: false,
      }),
      transformResponse: (response: TestReceiversResult) => {
        // Check if the response contains errors even though the HTTP status was 200
        if (receiversResponseContainsErrors(response)) {
          throw new Error(getReceiverResultError(response));
        }
        return response;
      },
    }),
  }),
});

interface TestReceiversOptions {
  alertManagerSourceName: string;
  receivers: Receiver[];
  alert?: TestReceiversAlert;
}

export const useGetContactPointsState = (alertManagerSourceName: string) => {
  const contactPointsStateEmpty: ContactPointsState = { receivers: {}, errorCount: 0 };
  const { currentData: contactPointsState } = receiversApi.useContactPointsStateQuery(
    { amSourceName: alertManagerSourceName ?? '' },
    {
      skip: !alertManagerSourceName,
      pollingInterval: CONTACT_POINTS_STATE_INTERVAL_MS,
    }
  );
  return contactPointsState ?? contactPointsStateEmpty;
};

export const { useTestIntegrationMutation } = receiversApi;

// Helper functions for checking receiver test results
function receiversResponseContainsErrors(result: TestReceiversResult): boolean {
  return result.receivers.some((receiver) =>
    receiver.grafana_managed_receiver_configs.some((config) => config.status === 'failed')
  );
}

function getReceiverResultError(receiversResult: TestReceiversResult): string {
  return receiversResult.receivers
    .flatMap((receiver) =>
      receiver.grafana_managed_receiver_configs
        .filter((config) => config.status === 'failed')
        .map((config) => config.error ?? 'Unknown error.')
    )
    .join('; ');
}
