import { render, screen, within } from 'test/test-utils';

import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { ctaClicked } from '../analytics/main';

import { FiringAlertsCard } from './FiringAlertsCard';
import { makeAlert, mockAlerts, mockTeams } from './alertIncidentTabsTestUtils';
import { useFiringAlerts } from './useFiringAlerts';

jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const criticalAlert = makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical', team: 'platform' } });
const highAlert = makeAlert({ labels: { alertname: 'Memory High', severity: 'high', team: 'platform' } });
const warningAlert = makeAlert({ labels: { alertname: 'Disk Warning', severity: 'warning', team: 'infra' } });
const critAliasAlert = makeAlert({ labels: { alertname: 'Crit Alias', severity: 'crit', team: 'platform' } });
const sev2Alert = makeAlert({ labels: { alertname: 'Sev2 Alert', severity: 'SEV2', team: 'platform' } });

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Grant alerting permission by default
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  jest.replaceProperty(contextSrv, 'isSignedIn', true);

  mockTeams([]);
  mockAlerts([]);
});

afterEach(() => {
  jest.restoreAllMocks();
  config.appSubUrl = '';
});

function FiringAlertsCardWithData() {
  const data = useFiringAlerts();
  return data.enabled ? <FiringAlertsCard data={data} /> : null;
}

describe('FiringAlertsCard', () => {
  it('renders alerts most severe first', async () => {
    mockTeams([]);
    mockAlerts([warningAlert, criticalAlert, highAlert]);

    render(<FiringAlertsCardWithData />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    const titles = screen
      .getAllByRole('listitem')
      .map((row) => within(row).getByText(/CPU Critical|Memory High|Disk Warning/).textContent);
    expect(titles).toEqual(['CPU Critical', 'Memory High', 'Disk Warning']);
  });

  it('labels each row with its severity', async () => {
    mockTeams([]);
    mockAlerts([criticalAlert, highAlert]);

    render(<FiringAlertsCardWithData />);

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

    render(<FiringAlertsCardWithData />);

    expect(await screen.findByRole('link', { name: /^Linked alert/ })).toHaveAttribute(
      'href',
      '/alerting/grafana/abc123/view?orgId=1'
    );
  });

  it('labels non-canonical severity aliases by canonical level', async () => {
    mockTeams([]);
    mockAlerts([critAliasAlert, sev2Alert]);

    render(<FiringAlertsCardWithData />);

    expect(await screen.findByText('Crit Alias')).toBeInTheDocument();

    // 'crit' canonicalizes to critical, 'SEV2' to major (labelled "High")
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders an alert with no severity label without crashing', async () => {
    const noSeverityAlert = makeAlert({ labels: { alertname: 'No Severity', team: 'platform' } });
    mockTeams([]);
    mockAlerts([noSeverityAlert]);

    render(<FiringAlertsCardWithData />);

    expect(await screen.findByText('No Severity')).toBeInTheDocument();
    expect(await screen.findByText('Unknown')).toBeInTheDocument();
  });

  it('shows team-scoped empty state when team-filtered result is empty', async () => {
    mockTeams([{ name: 'empty-team' }]);
    mockAlerts([]);

    render(<FiringAlertsCardWithData />);

    expect(await screen.findByText('All clear! No alerts are firing for your teams.')).toBeInTheDocument();
    expect(screen.queryByText('Show all firing alerts')).not.toBeInTheDocument();
  });

  it('hides the create action when the user lacks rule-create permission', async () => {
    mockTeams([]);
    mockAlerts([]);

    render(<FiringAlertsCardWithData />);

    expect(await screen.findByText('All clear! No alerts are firing.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create an alert rule/i })).not.toBeInTheDocument();
  });

  it('shows the create CTA in the empty state when permitted, prefixed with config.appSubUrl', async () => {
    config.appSubUrl = '/grafana';
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action: string) =>
          action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleCreate
      );
    mockTeams([]);
    mockAlerts([]);

    render(<FiringAlertsCardWithData />);

    expect(await screen.findByRole('link', { name: /create an alert rule/i })).toHaveAttribute(
      'href',
      '/grafana/alerting/new/alerting'
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

      const { user } = render(<FiringAlertsCardWithData />);

      await user.click(await screen.findByRole('link', { name: /^Linked alert/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'alerts_card',
        action: 'alert_detail',
        placement: 'list',
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

      const { user } = render(<FiringAlertsCardWithData />);

      await user.click(await screen.findByRole('link', { name: /create an alert rule/i }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'alerts_card',
        action: 'create_rule',
        placement: 'empty_state',
      });
    });
  });
});
