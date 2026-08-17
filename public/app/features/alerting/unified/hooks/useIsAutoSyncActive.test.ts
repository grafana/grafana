import { renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { type Config } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { setupAutoSyncConfig } from '../mocks/server/handlers/k8s/config.k8s';

import { resolveEffectiveSyncUid, useIsAutoSyncActive } from './useIsAutoSyncActive';

const INI_UID = 'ini-mimir-uid';
const SPEC_UID = 'spec-mimir-uid';

function buildConfig(spec: Config['spec'], status: Config['status']): Config {
  return {
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    kind: 'Config',
    metadata: { name: 'default' },
    spec,
    status,
  };
}

const notConfiguredCondition = {
  type: 'ExternalAlertmanagerSynced',
  status: 'Unknown',
  reason: 'NotConfigured',
  lastTransitionTime: '2026-01-01T00:00:00Z',
} as const;

describe('resolveEffectiveSyncUid', () => {
  it('returns the spec UID when only spec is set', () => {
    const config = buildConfig({ externalAlertmanagerSync: { datasourceUid: SPEC_UID } }, {});

    expect(resolveEffectiveSyncUid(config)).toBe(SPEC_UID);
  });

  it('returns the ini UID from status, which never reaches spec', () => {
    const config = buildConfig({}, { externalAlertmanagerSync: { datasourceUid: INI_UID, origin: 'ini' } });

    expect(resolveEffectiveSyncUid(config)).toBe(INI_UID);
  });

  it('ignores an ini UID once the syncer reports NotConfigured', () => {
    // The syncer keeps externalAlertmanagerSync as last-attempt context after sync stops, so the
    // condition is the only thing that releases a stale ini reading.
    const config = buildConfig(
      {},
      {
        externalAlertmanagerSync: { datasourceUid: INI_UID, origin: 'ini' },
        conditions: [notConfiguredCondition],
      }
    );

    expect(resolveEffectiveSyncUid(config)).toBeUndefined();
  });

  it('prefers the ini UID over spec, matching the backend resolution order', () => {
    const config = buildConfig(
      { externalAlertmanagerSync: { datasourceUid: SPEC_UID } },
      { externalAlertmanagerSync: { datasourceUid: INI_UID, origin: 'ini' } }
    );

    expect(resolveEffectiveSyncUid(config)).toBe(INI_UID);
  });

  it('ignores an api-origin status, which lags spec', () => {
    const config = buildConfig({}, { externalAlertmanagerSync: { datasourceUid: SPEC_UID, origin: 'api' } });

    expect(resolveEffectiveSyncUid(config)).toBeUndefined();
  });

  it('returns undefined when the Config is unreadable', () => {
    expect(resolveEffectiveSyncUid(undefined)).toBeUndefined();
  });
});

describe('useIsAutoSyncActive', () => {
  const server = setupMswServer();

  testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

  beforeEach(() => {
    grantUserPermissions([AccessControlAction.ActionAlertingNotificationsConfigRead]);
  });

  it('reports an ini-configured sync as active, using its datasource UID', async () => {
    setupAutoSyncConfig(server, { statusUid: INI_UID, statusOrigin: 'ini' });

    const wrapper = getWrapper({ renderWithRouter: false });
    const { result } = renderHook(() => useIsAutoSyncActive(), { wrapper });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });
    expect(result.current.datasourceUid).toBe(INI_UID);
  });
});
