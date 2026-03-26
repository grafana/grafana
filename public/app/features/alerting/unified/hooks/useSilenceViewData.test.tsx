import { HttpResponse } from 'msw';
import { PropsWithChildren } from 'react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { MOCK_SILENCE_ID_EXISTING, grantUserPermissions, mockAlertmanagerAlert } from '../mocks';
import { setAlertmanagerAlertsHandler, setSilenceGetResolver } from '../mocks/server/configure';
import { AlertmanagerProvider } from '../state/AlertmanagerContext';

import { useSilenceViewData } from './useSilenceViewData';

setupMswServer();

function createWrapper(silenceId: string) {
  const ProviderWrapper = getWrapper({
    renderWithRouter: true,
    historyOptions: {
      initialEntries: [`/alerting/silence/${silenceId}/view`],
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <ProviderWrapper>
        <Routes>
          <Route
            path="/alerting/silence/:id/view"
            element={<AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>}
          />
        </Routes>
      </ProviderWrapper>
    );
  };
}

describe('useSilenceViewData', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingSilenceRead]);
    setAlertmanagerAlertsHandler([]);
  });

  it('returns loading state initially', () => {
    const { result } = renderHook(() => useSilenceViewData(), { wrapper: createWrapper(MOCK_SILENCE_ID_EXISTING) });

    expect(result.current.isLoading).toBeTruthy();
    expect(result.current.silence).toBeUndefined();
    expect(result.current.silencedAlerts).toEqual([]);
  });

  it('returns silence and filtered silenced alerts on success', async () => {
    const silenceId = MOCK_SILENCE_ID_EXISTING;
    setAlertmanagerAlertsHandler([
      mockAlertmanagerAlert({
        fingerprint: 'matching-alert',
        status: { state: AlertState.Suppressed, silencedBy: [silenceId], inhibitedBy: [] },
        labels: { alertname: 'MatchingAlert' },
      }),
      mockAlertmanagerAlert({
        fingerprint: 'non-matching-alert',
        status: { state: AlertState.Suppressed, silencedBy: ['another-silence-id'], inhibitedBy: [] },
        labels: { alertname: 'NonMatchingAlert' },
      }),
    ]);

    const { result } = renderHook(() => useSilenceViewData(), { wrapper: createWrapper(silenceId) });

    await waitFor(() => {
      expect(result.current.isLoading).toBeFalsy();
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.silence).toBeDefined();
    expect(result.current.silencedAlerts).toHaveLength(1);
    expect(result.current.silencedAlerts[0].labels.alertname).toBe('MatchingAlert');
  });

  it('returns error state on silence API failure', async () => {
    setSilenceGetResolver(() => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }));

    const { result } = renderHook(() => useSilenceViewData(), { wrapper: createWrapper(MOCK_SILENCE_ID_EXISTING) });

    await waitFor(() => {
      expect(result.current.isLoading).toBeFalsy();
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.silence).toBeUndefined();
    expect(result.current.silencedAlerts).toEqual([]);
  });

  it('returns not found state on 404 silence response', async () => {
    setSilenceGetResolver(() => HttpResponse.json({ message: 'Not found' }, { status: 404 }));

    const { result } = renderHook(() => useSilenceViewData(), { wrapper: createWrapper('non-existent-id') });

    await waitFor(() => {
      expect(result.current.isLoading).toBeFalsy();
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.silence).toBeUndefined();
    expect(result.current.silencedAlerts).toEqual([]);
  });
});
