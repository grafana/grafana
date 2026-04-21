import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { getWrapper } from 'test/test-utils';

import { base64UrlEncode } from '@grafana/alerting';
import { API_GROUP, API_VERSION, type Receiver } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import server from '@grafana/test-utils/server';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { receiverConfigToK8sIntegration, stringifyFieldSelector } from 'app/features/alerting/unified/utils/k8s/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

import { useGetContactPoint } from './useContactPoints';

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

setupMswServer();

describe('useGetContactPoint (Grafana managed / K8s)', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
  });

  it('returns the contact point when the lookup name matches metadata.name (resource id)', async () => {
    const { result } = renderHook(
      () =>
        useGetContactPoint({
          alertmanager: GRAFANA_RULES_SOURCE_NAME,
          name: 'lotsa-emails',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.data?.name).toBe('lotsa-emails');
    expect(result.current.data?.id).toBe('lotsa-emails');
  });

  it('resolves by listing with metadata.name = base64UrlEncode(title) when a direct metadata.name match returns no items', async () => {
    const title = 'unique-cp-title-for-get-test';

    const receiver: Receiver = {
      apiVersion: `${API_GROUP}/${API_VERSION}`,
      kind: 'Receiver',
      metadata: {
        name: base64UrlEncode(title),
        namespace: 'default',
        uid: 'test-receiver-uid',
      },
      spec: {
        title,
        integrations: [
          receiverConfigToK8sIntegration({
            uid: 'int-uid-1',
            name: 'email',
            type: 'email',
            disableResolveMessage: false,
            settings: { addresses: 'test@example.com' },
            secureFields: {},
          }),
        ],
      },
    };

    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers`, ({ request }) => {
        const fieldSelector = new URL(request.url).searchParams.get('fieldSelector');
        const directFs = stringifyFieldSelector([['metadata.name', title]]);
        const encodedFs = stringifyFieldSelector([['metadata.name', base64UrlEncode(title)]]);
        if (fieldSelector === directFs) {
          return HttpResponse.json(getK8sResponse('ReceiverList', []));
        }
        if (fieldSelector === encodedFs) {
          return HttpResponse.json(getK8sResponse('ReceiverList', [receiver]));
        }
        return HttpResponse.json(getK8sResponse('ReceiverList', []));
      })
    );

    const { result } = renderHook(
      () =>
        useGetContactPoint({
          alertmanager: GRAFANA_RULES_SOURCE_NAME,
          name: title,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.data?.name).toBe(title);
    expect(result.current.data?.id).toBe(base64UrlEncode(title));
  });
});
