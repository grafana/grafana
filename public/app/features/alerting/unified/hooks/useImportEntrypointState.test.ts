import { renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../mockApi';
import { grantUserRole } from '../mocks';
import { setupAdminConfigGet } from '../mocks/server/configure/admin_config';

import { useImportEntrypointState } from './useImportEntrypointState';

const server = setupMswServer();

function renderUseImportEntrypointState() {
  const wrapper = getWrapper({ renderWithRouter: false });
  return renderHook(() => useImportEntrypointState(), { wrapper });
}

describe('useImportEntrypointState', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
  });

  describe('with alerting.syncExternalAlertmanager feature flag enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    it('returns disabled with a localized reason when admin_config has external_alertmanager_uid', async () => {
      setupAdminConfigGet(server, {
        alertmanagersChoice: AlertmanagerChoice.Internal,
        external_alertmanager_uid: 'mimir-uid',
      });

      const { result } = renderUseImportEntrypointState();

      await waitFor(() => {
        expect(result.current.disabled).toBe(true);
      });
      expect(result.current.reason).toMatch(/auto-sync/i);
    });

    it('returns not disabled when admin_config has no external_alertmanager_uid', async () => {
      setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });

      const { result } = renderUseImportEntrypointState();

      // Give the query a chance to resolve before asserting the false case.
      await waitFor(() => {
        expect(result.current.disabled).toBe(false);
      });
      expect(result.current.reason).toBeUndefined();
    });
  });

  describe('with alerting.syncExternalAlertmanager feature flag disabled', () => {
    it('returns not disabled regardless of admin_config state', () => {
      setupAdminConfigGet(server, {
        alertmanagersChoice: AlertmanagerChoice.Internal,
        external_alertmanager_uid: 'mimir-uid',
      });

      const { result } = renderUseImportEntrypointState();

      // Feature flag gates the query — the hook should not consider auto-sync active.
      expect(result.current.disabled).toBe(false);
      expect(result.current.reason).toBeUndefined();
    });
  });
});
