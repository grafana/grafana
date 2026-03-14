/** @deprecated To be deleted - use alertingApiServer API instead */

import { Receiver, TestReceiversAlert, TestReceiversResult } from 'app/plugins/datasource/alertmanager/types';

import { getDatasourceAPIUid } from '../utils/datasource';

import { alertingApi } from './alertingApi';

export const receiversApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
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
