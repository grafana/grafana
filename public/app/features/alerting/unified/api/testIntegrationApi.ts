import { getAPINamespace } from '../../../../api/utils';

import { alertingApi } from './alertingApi';

interface TestIntegrationAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface TestIntegrationSettings {
  uid?: string;
  type: string;
  version?: string;
  settings: Record<string, unknown>;
  secureFields?: Record<string, boolean>;
  disableResolveMessage?: boolean;
}

export interface TestIntegrationRequest {
  receiverUid: string;
  integration: TestIntegrationSettings;
  alert: TestIntegrationAlert;
}

export interface TestIntegrationResponse {
  apiVersion: string;
  kind: string;
  status: 'success' | 'failure';
  duration: string;
  error?: string;
}

const NEW_RECEIVER_PLACEHOLDER = '-';

export const testIntegrationApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    testIntegrationK8s: build.mutation<TestIntegrationResponse, TestIntegrationRequest>({
      query: (params) => {
        const namespace = getAPINamespace();
        const receiverName = params.receiverUid || NEW_RECEIVER_PLACEHOLDER;

        const body = {
          integration: params.integration,
          alert: params.alert,
        };

        return {
          url: `/apis/alertingnotifications.grafana.app/v0alpha1/namespaces/${namespace}/receivers/${receiverName}/test`,
          method: 'POST',
          data: body,
        };
      },
    }),
  }),
});

export const { useTestIntegrationK8sMutation } = testIntegrationApi;
