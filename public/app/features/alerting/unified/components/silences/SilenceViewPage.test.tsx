import { HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen } from 'test/test-utils';

import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { MOCK_SILENCE_ID_EXISTING, grantUserPermissions, mockAlertmanagerAlert, mockSilence } from '../../mocks';
import { setAlertmanagerAlertsHandler, setSilenceGetResolver } from '../../mocks/server/configure';
import { MOCK_GRAFANA_ALERT_RULE_TITLE } from '../../mocks/server/handlers/grafanaRuler';

import SilenceViewPage from './SilenceViewPage';

const MOCK_RULE_UID = 'abc-rule-uid-123';

setupMswServer();

function renderSilenceViewPage(silenceId: string) {
  return render(
    <Routes>
      <Route path="/alerting/silence/:id/view" element={<SilenceViewPage />} />
    </Routes>,
    {
      historyOptions: {
        initialEntries: [`/alerting/silence/${silenceId}/view`],
      },
    }
  );
}

describe('SilenceViewPage', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingSilenceRead]);

    // Return no alerts by default to avoid duplicate key warnings from mock data
    setAlertmanagerAlertsHandler([]);
  });

  it('should show loading state initially', () => {
    renderSilenceViewPage(MOCK_SILENCE_ID_EXISTING);
    expect(screen.getByText(/Loading silence/)).toBeInTheDocument();
  });

  it('should render silence details for an existing silence', async () => {
    renderSilenceViewPage(MOCK_SILENCE_ID_EXISTING);

    expect(await screen.findByText('Happy path silence')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('should render matchers for an existing silence', async () => {
    renderSilenceViewPage(MOCK_SILENCE_ID_EXISTING);

    expect(await screen.findByText('Happy path silence')).toBeInTheDocument();
    expect(screen.getByText(/foo=bar/)).toBeInTheDocument();
  });

  it('should show not found for non-existent silence', async () => {
    renderSilenceViewPage('non-existent-id');

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it('should show error state on API failure', async () => {
    setSilenceGetResolver(() => {
      return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
    });

    renderSilenceViewPage(MOCK_SILENCE_ID_EXISTING);

    expect(await screen.findByText(/Error loading silence/)).toBeInTheDocument();
  });

  it('should display affected alerts when present', async () => {
    const silenceId = MOCK_SILENCE_ID_EXISTING;
    setAlertmanagerAlertsHandler([
      mockAlertmanagerAlert({
        fingerprint: 'unique-fingerprint-1',
        status: { state: AlertState.Suppressed, silencedBy: [silenceId], inhibitedBy: [] },
        labels: { alertname: 'TestAlert', severity: 'warning' },
      }),
    ]);

    renderSilenceViewPage(silenceId);

    expect(await screen.findByText('Happy path silence')).toBeInTheDocument();
    expect(await screen.findByText('TestAlert')).toBeInTheDocument();
  });

  it('should show alert rule link when metadata is present', async () => {
    const silenceId = 'silence-with-rule-metadata';
    const silenceWithRule = mockSilence({
      id: silenceId,
      comment: 'Silence targeting a specific rule',
      metadata: {
        rule_title: MOCK_GRAFANA_ALERT_RULE_TITLE,
        rule_uid: MOCK_RULE_UID,
      },
    });

    setSilenceGetResolver(({ request }) => {
      const ruleMetadataQueryParam = new URL(request.url).searchParams.get('ruleMetadata');
      const { metadata, ...silence } = silenceWithRule;
      return HttpResponse.json({
        ...silence,
        ...(ruleMetadataQueryParam && { metadata }),
      });
    });

    renderSilenceViewPage(silenceId);

    const ruleLink = await screen.findByRole('link', { name: MOCK_GRAFANA_ALERT_RULE_TITLE });
    expect(ruleLink).toBeInTheDocument();
    const parsedRuleLink = new URL(ruleLink.getAttribute('href') ?? '', 'http://localhost');
    expect(parsedRuleLink.pathname).toBe(`/alerting/grafana/${encodeURIComponent(MOCK_RULE_UID)}/view`);
    expect(parsedRuleLink.searchParams.get('returnTo')).toBe(`/alerting/silence/${silenceId}/view`);
  });
});
