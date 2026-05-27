import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { AlertState } from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../mockApi';
import { mockAlertmanagerAlert } from '../mocks';
import { setAlertmanagerAlertsHandler } from '../mocks/server/configure';

import { useHasInhibitedInstances } from './useHasInhibitedInstances';

setupMswServer();

const TEST_RULE_UID = 'test-rule-uid-123';
const OTHER_RULE_UID = 'other-rule-uid-456';

const wrapper = () => getWrapper({ renderWithRouter: true });

describe('useHasInhibitedInstances', () => {
  beforeEach(() => {
    setAlertmanagerAlertsHandler([]);
  });

  it('should return false when no inhibited alerts exist', async () => {
    const { result } = renderHook(() => useHasInhibitedInstances(TEST_RULE_UID), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitedInstances).toBe(false);
  });

  it('should return true when an inhibited alert matches the rule UID', async () => {
    setAlertmanagerAlertsHandler([
      mockAlertmanagerAlert({
        labels: { __alert_rule_uid__: TEST_RULE_UID, alertname: 'TestAlert' },
        status: { state: AlertState.Suppressed, silencedBy: [], inhibitedBy: ['source-fingerprint'] },
      }),
    ]);

    const { result } = renderHook(() => useHasInhibitedInstances(TEST_RULE_UID), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitedInstances).toBe(true);
  });

  it('should return false when inhibited alerts exist but none match the rule UID', async () => {
    setAlertmanagerAlertsHandler([
      mockAlertmanagerAlert({
        labels: { __alert_rule_uid__: OTHER_RULE_UID, alertname: 'OtherAlert' },
        status: { state: AlertState.Suppressed, silencedBy: [], inhibitedBy: ['source-fingerprint'] },
      }),
    ]);

    const { result } = renderHook(() => useHasInhibitedInstances(TEST_RULE_UID), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitedInstances).toBe(false);
  });

  it('should return isLoading true initially', () => {
    const { result } = renderHook(() => useHasInhibitedInstances(TEST_RULE_UID), { wrapper: wrapper() });

    expect(result.current.isLoading).toBe(true);
  });

  it('should return false when ruleUid is undefined', async () => {
    setAlertmanagerAlertsHandler([
      mockAlertmanagerAlert({
        labels: { __alert_rule_uid__: TEST_RULE_UID },
        status: { state: AlertState.Suppressed, silencedBy: [], inhibitedBy: ['source-fingerprint'] },
      }),
    ]);

    const { result } = renderHook(() => useHasInhibitedInstances(undefined), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitedInstances).toBe(false);
  });

  it('should return false when the API call fails', async () => {
    const { http, HttpResponse } = await import('msw');
    const { default: mswServer } = await import('@grafana/test-utils/server');

    mswServer.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () =>
        HttpResponse.json({ message: 'internal server error' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useHasInhibitedInstances(TEST_RULE_UID), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitedInstances).toBe(false);
  });
});
