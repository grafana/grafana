import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { getWrapper } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { ALERTING_API_SERVER_BASE_URL } from '../../mocks/server/utils';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { useNotificationTemplates } from './useNotificationTemplates';

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

const server = setupMswServer();

describe('useNotificationTemplates', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
  });

  it('returns an empty template list when the template group list has no items', async () => {
    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/templategroups`, () =>
        HttpResponse.json({ kind: 'TemplateGroupList', metadata: {} })
      )
    );

    const { result } = renderHook(() => useNotificationTemplates({ alertmanager: GRAFANA_RULES_SOURCE_NAME }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.data).toEqual([]);
  });
});
