import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { alertsCardClicked } from '../analytics/main';

import { FiringAlertsCard } from './FiringAlertsCard';
import { HOME_CARD_MAX_ITEMS } from './constants';

jest.mock('../analytics/main', () => ({
  alertsCardClicked: jest.fn(),
  incidentsCardClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  emptyCtaClicked: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

function makeAlert(overrides: Partial<AlertmanagerAlert> & { labels: AlertmanagerAlert['labels'] }): AlertmanagerAlert {
  return {
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
    endsAt: '0001-01-01T00:00:00Z',
    fingerprint: Math.random().toString(36).slice(2),
    receivers: [{ name: 'default' }],
    status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
    annotations: {},
    ...overrides,
    labels: { alertname: 'test', ...overrides.labels },
  };
}

const criticalAlert = makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical', team: 'platform' } });
const highAlert = makeAlert({ labels: { alertname: 'Memory High', severity: 'high', team: 'platform' } });
const warningAlert = makeAlert({ labels: { alertname: 'Disk Warning', severity: 'warning', team: 'infra' } });
const critAliasAlert = makeAlert({ labels: { alertname: 'Crit Alias', severity: 'crit', team: 'platform' } });
const sev2Alert = makeAlert({ labels: { alertname: 'Sev2 Alert', severity: 'SEV2', team: 'platform' } });

function mockTeams(teams: Array<{ name: string }>) {
  server.use(
    http.get('/api/user/teams', () =>
      HttpResponse.json(
        teams.map((t, i) => ({ ...t, id: i + 1, uid: `team-${i}`, orgId: 1, memberCount: 1, isProvisioned: false }))
      )
    )
  );
}

function mockAlerts(alerts: AlertmanagerAlert[]) {
  server.use(http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json(alerts)));
}

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Grant alerting permission by default
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  mockTeams([]);
  mockAlerts([]);
});

afterEach(() => {
  jest.restoreAllMocks();
  config.appSubUrl = '';
});

describe('FiringAlertsCard', () => {
  it('renders null when user lacks AlertingInstanceRead permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const { container } = render(<FiringAlertsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders alerts sorted by severity', async () => {
    mockTeams([]);
    mockAlerts([warningAlert, criticalAlert, highAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    expect(screen.getByText('Memory High')).toBeInTheDocument();
    expect(screen.getByText('Disk Warning')).toBeInTheDocument();

    // Severity counts in header
    expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
    expect(screen.getByText(/1 high/i)).toBeInTheDocument();
  });

  it('labels each row with its severity', async () => {
    mockTeams([]);
    mockAlerts([criticalAlert, highAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('links alert titles to their detail pages', async () => {
    const linkedAlert = makeAlert({
      generatorURL: 'https://grafana.example.com/alerting/grafana/abc123/view?orgId=1',
      labels: { alertname: 'Linked alert', severity: 'critical', team: 'platform' },
    });
    mockTeams([]);
    mockAlerts([linkedAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByRole('link', { name: /^Linked alert/ })).toHaveAttribute(
      'href',
      '/alerting/grafana/abc123/view?orgId=1'
    );
  });

  it('counts non-canonical severity aliases by canonical level', async () => {
    mockTeams([]);
    mockAlerts([critAliasAlert, sev2Alert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('Crit Alias')).toBeInTheDocument();

    // 'crit' canonicalizes to critical, 'SEV2' to major (shown as the "high" badge)
    expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
    expect(screen.getByText(/1 high/i)).toBeInTheDocument();
  });

  it('renders an alert with no severity label without crashing', async () => {
    const noSeverityAlert = makeAlert({ labels: { alertname: 'No Severity', team: 'platform' } });
    mockTeams([]);
    mockAlerts([noSeverityAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('No Severity')).toBeInTheDocument();
    expect(await screen.findByText('Unknown')).toBeInTheDocument();

    // Missing severity must not crash canonicalSeverity and must not be counted in either badge
    expect(screen.queryByText(/\d+ critical/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ high/i)).not.toBeInTheDocument();
  });

  it('builds team matchers when user has teams', async () => {
    const capturedRequests: Request[] = [];
    mockTeams([{ name: 'platform' }, { name: 'infra' }]);

    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        capturedRequests.push(request);
        return HttpResponse.json([criticalAlert]);
      })
    );

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    // Verify that the request included a team filter matcher
    const lastReq = capturedRequests[capturedRequests.length - 1];
    const url = new URL(lastReq.url);
    const filters = url.searchParams.getAll('filter');
    expect(filters.some((f) => f.includes('team') && f.includes('platform|infra'))).toBe(true);
  });

  it('escapes regex metacharacters in team names', async () => {
    const capturedRequests: Request[] = [];
    mockTeams([{ name: 'team.one' }]);

    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        capturedRequests.push(request);
        return HttpResponse.json([criticalAlert]);
      })
    );

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    // buildTeamMatchers escapes the '.' to '\.', then quoteWithEscape doubles the backslash on the wire
    const lastReq = capturedRequests[capturedRequests.length - 1];
    const filters = new URL(lastReq.url).searchParams.getAll('filter');
    expect(filters.some((f) => f.includes('team\\\\.one'))).toBe(true);
  });

  it('shows team-scoped empty state when team-filtered result is empty', async () => {
    mockTeams([{ name: 'empty-team' }]);
    mockAlerts([]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('No firing alerts for your teams.')).toBeInTheDocument();

    expect(screen.queryByText('Show all firing alerts')).not.toBeInTheDocument();
  });

  it('shows generic empty state when user has no teams', async () => {
    mockTeams([]);
    mockAlerts([]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('You have no firing alerts.')).toBeInTheDocument();
  });

  it('caps the rendered list at HOME_CARD_MAX_ITEMS while badges count every alert', async () => {
    mockTeams([]);
    // Pin descending ages so the cap deterministically drops the oldest alert, not whichever one
    // happened to straddle a Date.now() millisecond boundary during construction.
    const many = Array.from({ length: HOME_CARD_MAX_ITEMS + 1 }, (_, i) =>
      makeAlert({
        startsAt: new Date(Date.now() - i * 1000).toISOString(),
        labels: { alertname: `Alert ${i}`, severity: 'critical', team: 'platform' },
      })
    );
    mockAlerts(many);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('Alert 0')).toBeInTheDocument();
    // Render is capped even though one more alert is firing...
    expect(screen.getAllByRole('listitem')).toHaveLength(HOME_CARD_MAX_ITEMS);
    // ...but the severity badge still counts every alert.
    expect(screen.getByText(new RegExp(`${HOME_CARD_MAX_ITEMS + 1} critical`, 'i'))).toBeInTheDocument();
  });

  it('shows the create action next to view-all when permitted and alerts exist', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action: string) =>
          action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleCreate
      );
    mockTeams([]);
    mockAlerts([criticalAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByRole('link', { name: /create an alert rule/i })).toHaveAttribute(
      'href',
      '/alerting/new/alerting'
    );
    expect(screen.getByRole('link', { name: /view all firing alerts/i })).toBeInTheDocument();
  });

  it('shows the create CTA in the empty state when permitted', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action: string) =>
          action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleCreate
      );
    mockTeams([]);
    mockAlerts([]);

    render(<FiringAlertsCard />);

    expect(await screen.findByRole('link', { name: /create an alert rule/i })).toHaveAttribute(
      'href',
      '/alerting/new/alerting'
    );
    expect(screen.queryByText('You have no firing alerts.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view all alert rules/i })).toBeInTheDocument();
  });

  it('hides the create action when the user lacks rule-create permission', async () => {
    mockTeams([]);
    mockAlerts([criticalAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create an alert rule/i })).not.toBeInTheDocument();
  });

  it('prefixes the create and view-all-groups links with config.appSubUrl when alerts exist', async () => {
    config.appSubUrl = '/grafana';
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action: string) =>
          action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleCreate
      );
    mockTeams([]);
    mockAlerts([criticalAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByRole('link', { name: /create an alert rule/i })).toHaveAttribute(
      'href',
      '/grafana/alerting/new/alerting'
    );
    expect(screen.getByRole('link', { name: /view all firing alerts/i })).toHaveAttribute(
      'href',
      '/grafana/alerting/groups?alertmanager=grafana'
    );
  });

  it('prefixes the create and view-all-rules links with config.appSubUrl in the empty state', async () => {
    config.appSubUrl = '/grafana';
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action: string) =>
          action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleCreate
      );
    mockTeams([]);
    mockAlerts([]);

    render(<FiringAlertsCard />);

    expect(await screen.findByRole('link', { name: /create an alert rule/i })).toHaveAttribute(
      'href',
      '/grafana/alerting/new/alerting'
    );
    // colon is percent-encoded by URLSearchParams; decodes back to source:grafana on read
    expect(screen.getByRole('link', { name: /view all alert rules/i })).toHaveAttribute(
      'href',
      '/grafana/alerting/list?search=source%3Agrafana'
    );
  });

  describe('analytics', () => {
    // LinkButton renders a plain <a href>; clicking it would trigger a real jsdom
    // navigation (console.error -> jest-fail-on-console). Route anchor clicks through
    // the SPA history the way the app does so the onClick fires without navigating.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

    it('tracks alert_detail when an alert title link is clicked', async () => {
      const linkedAlert = makeAlert({
        generatorURL: 'https://grafana.example/alerting/foo?bar=1',
        labels: { alertname: 'Linked alert', severity: 'critical', team: 'platform' },
      });
      mockTeams([]);
      mockAlerts([linkedAlert]);

      const { user } = render(<FiringAlertsCard />);

      await user.click(await screen.findByRole('link', { name: /^Linked alert/ }));

      expect(jest.mocked(alertsCardClicked)).toHaveBeenCalledWith({
        action: 'alert_detail',
        placement: 'list',
        severity: 'critical',
      });
    });

    it('tracks create_rule from the empty-state CTA', async () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation(
          (action: string) =>
            action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleCreate
        );
      mockTeams([]);
      mockAlerts([]);

      const { user } = render(<FiringAlertsCard />);

      await user.click(await screen.findByRole('link', { name: /create an alert rule/i }));

      expect(jest.mocked(alertsCardClicked)).toHaveBeenCalledWith({
        action: 'create_rule',
        placement: 'empty_state',
      });
    });

    it('tracks create_rule and view_all_alerts from the footer when alerts exist', async () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation(
          (action: string) =>
            action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleCreate
        );
      mockTeams([]);
      mockAlerts([criticalAlert]);

      const { user } = render(<FiringAlertsCard />);

      await user.click(await screen.findByRole('link', { name: /create an alert rule/i }));
      expect(jest.mocked(alertsCardClicked)).toHaveBeenCalledWith({
        action: 'create_rule',
        placement: 'footer',
      });

      await user.click(screen.getByRole('link', { name: /view all firing alerts/i }));
      expect(jest.mocked(alertsCardClicked)).toHaveBeenCalledWith({
        action: 'view_all_alerts',
        placement: 'footer',
      });
    });

    it('tracks view_all_rules from the footer in the empty state', async () => {
      mockTeams([]);
      mockAlerts([]);

      const { user } = render(<FiringAlertsCard />);

      await user.click(await screen.findByRole('link', { name: /view all alert rules/i }));

      expect(jest.mocked(alertsCardClicked)).toHaveBeenCalledWith({
        action: 'view_all_rules',
        placement: 'footer',
      });
    });
  });
});
