import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { useAssistant } from '@grafana/assistant';
import { config, setPluginComponentsHook } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { type Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import {
  grantUserPermissions,
  mockDataSource,
  mockGrafanaPromAlertingRule,
  mockGrafanaPromRuleGroup,
  mockSilence,
} from '../../mocks';
import { setGrafanaPromRules, setPrometheusRules } from '../../mocks/server/configure';
import { alertingFactory } from '../../mocks/server/db';
import { HISTORIAN_BASE } from '../../mocks/server/handlers/historian';
import { setupDataSources } from '../../testSetup/datasources';

import RevampedHome from './RevampedHome';
import { getAttentionDismissedKey } from './RunningOverview';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
}));
const mockUseAssistant = jest.mocked(useAssistant);
const openAssistant = jest.fn();

setPluginComponentsHook(() => ({ components: [], isLoading: false }));
setupMswServer();

const MIMIR = mockDataSource({ name: 'Mimir', uid: 'mimir', type: 'prometheus', jsonData: { manageAlerts: true } });

const ui = {
  setupHeading: byRole('heading', { name: 'Set up alerting' }),
  setupRegion: byRole('region', { name: 'Set up alerting' }),
  noGrafanaRules: byText('No Grafana-managed alert rules yet'),
  tile: (name: string) => byRole('region', { name }),
  needsAttention: byRole('region', { name: 'Needs attention' }),
  topFiringRules: byRole('region', { name: 'Top firing rules' }),
  deliveryByChannel: byRole('region', { name: 'Delivery by channel' }),
  analyzeButton: byRole('button', { name: /analyze with assistant/i }),
};

const NOTIFICATIONS_API = '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/:namespace';

function setNotificationConfig({ contactPoints, nestedPolicies }: { contactPoints: number; nestedPolicies: number }) {
  server.use(
    http.get(`${NOTIFICATIONS_API}/receivers`, () =>
      HttpResponse.json({
        items: Array.from({ length: contactPoints }, (_, i) => ({
          metadata: { name: `cp-${i}` },
          spec: { title: `cp-${i}`, integrations: [] },
        })),
      })
    ),
    http.get(`${NOTIFICATIONS_API}/routingtrees`, () =>
      HttpResponse.json({
        items: [
          {
            metadata: { name: 'user-defined' },
            spec: {
              defaults: { receiver: 'cp-0' },
              routes: Array.from({ length: nestedPolicies }, () => ({ continue: false })),
            },
          },
        ],
      })
    )
  );
}

function setSilences(silences: Silence[]) {
  server.use(http.get('/api/alertmanager/grafana/api/v2/silences', () => HttpResponse.json(silences)));
}

function setDeliveryCounts(counts: Array<{ integration: string; outcome: 'success' | 'error'; count: number }>) {
  server.use(
    http.post(`${HISTORIAN_BASE}/notification/query`, () =>
      HttpResponse.json({ entries: [], counts: counts.map((count) => ({ ...count, values: [] })) })
    )
  );
}

const runningStack: GrafanaPromRuleGroupDTO[] = [
  mockGrafanaPromRuleGroup({
    rules: [
      mockGrafanaPromAlertingRule({ uid: 'cpu', name: 'CPU high', totals: { alerting: 7, pending: 2, inactive: 30 } }),
      mockGrafanaPromAlertingRule({ uid: 'disk', name: 'Disk full', totals: { alerting: 3, nodata: 1 } }),
      mockGrafanaPromAlertingRule({ uid: 'broken', name: 'Broken', health: 'error', totals: { error: 4 } }),
      mockGrafanaPromAlertingRule({ uid: 'paused', name: 'Paused one', isPaused: true, totals: {} }),
    ],
  }),
];

const notificationHistoryEnabled = config.unifiedAlerting.notificationHistoryEnabled;

beforeEach(() => {
  localStorage.clear();
  openAssistant.mockClear();
  mockUseAssistant.mockReturnValue({ isAvailable: false, openAssistant: undefined } as ReturnType<typeof useAssistant>);
  grantUserPermissions([
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingInstanceRead,
  ]);
  config.unifiedAlerting.notificationHistoryEnabled = false;
  setSilences([]);
  setNotificationConfig({ contactPoints: 0, nestedPolicies: 0 });
  setupDataSources();
});

afterEach(() => {
  config.unifiedAlerting.notificationHistoryEnabled = notificationHistoryEnabled;
});

describe('RevampedHome shortcuts', () => {
  it('links to the main alerting areas', async () => {
    setGrafanaPromRules([]);

    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    // The counts arrive with the rules and silences requests.
    expect(await within(nav).findByRole('link', { name: '0 Alert rules' })).toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: '1 Notification policies' })).toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: '0 Contact points' })).toBeInTheDocument();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')])
    ).toEqual([
      ['0Alert rules', '/alerting/list'],
      ['0Contact points', '/alerting/notifications'],
      ['1Notification policies', '/alerting/routes'],
      ['0Silences', '/alerting/silences'],
      ['Alert activity', '/alerting/alerts'],
      ['History', '/alerting/history'],
    ]);
  });

  it('counts alert rules and active silences, with a + when the rules were capped', async () => {
    server.use(
      http.get('/api/prometheus/grafana/api/v1/rules', () =>
        HttpResponse.json({ status: 'success', data: { groups: runningStack, groupNextToken: 'more' } })
      )
    );
    setSilences([mockSilence({ id: 'a' }), mockSilence({ id: 'b' })]);

    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    expect(await within(nav).findByRole('link', { name: '4+ Alert rules' })).toHaveAttribute('href', '/alerting/list');
    expect(await within(nav).findByRole('link', { name: '2 Silences' })).toHaveAttribute('href', '/alerting/silences');
  });

  it('counts contact points and every notification policy, the default one included', async () => {
    setGrafanaPromRules([]);
    setNotificationConfig({ contactPoints: 3, nestedPolicies: 2 });

    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    expect(await within(nav).findByRole('link', { name: '3 Contact points' })).toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: '3 Notification policies' })).toBeInTheDocument();
  });
});

describe('RevampedHome without Grafana-managed rules', () => {
  it('shows the setup steps in dependency order when no data source holds rules either', async () => {
    setGrafanaPromRules([]);

    render(<RevampedHome />);

    const setup = await ui.setupRegion.find();
    const links = within(setup).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Create alert rule', '/alerting/new/alerting'],
      ['Add contact point', '/alerting/notifications/receivers/new'],
      ['Open notification policies', '/alerting/routes'],
    ]);
  });

  it('marks creating an alert rule as the step to do next', async () => {
    setGrafanaPromRules([]);

    render(<RevampedHome />);

    const steps = within(await ui.setupRegion.find()).getAllByRole('listitem');
    expect(steps.map((step) => within(step).queryByText('Do this next') !== null)).toEqual([true, false, false]);
    expect(within(steps[0]).getByText('Create an alert rule')).toBeInTheDocument();
  });

  it('explains how alerting works, linking each concept to its docs and to the getting started tutorial', async () => {
    setGrafanaPromRules([]);

    render(<RevampedHome />);

    const howItWorks = await screen.findByRole('region', { name: 'How it works' });
    const docs = 'https://grafana.com/docs/grafana/latest/alerting/fundamentals';
    expect(
      within(howItWorks)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => [heading.textContent, within(heading).getByRole('link').getAttribute('href')])
    ).toEqual([
      ['Alert rule', `${docs}/alert-rules/`],
      ['Alert instances', `${docs}/alert-rule-evaluation/alert-rule-state-and-health/`],
      ['Notification policy', `${docs}/notifications/notification-policies/`],
      ['Contact point', `${docs}/notifications/contact-points/`],
    ]);
    expect(within(howItWorks).getByRole('link', { name: /Read the tutorial/ })).toHaveAttribute(
      'href',
      'https://grafana.com/tutorials/alerting-get-started/'
    );
  });

  it('has no time range picker on the setup steps, even when notification history is on', async () => {
    config.unifiedAlerting.notificationHistoryEnabled = true;
    setGrafanaPromRules([]);

    render(<RevampedHome />);

    expect(await ui.setupRegion.find()).toBeInTheDocument();
    expect(screen.queryByLabelText(/time range selected/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh the alerting overview' })).toBeInTheDocument();
  });

  it('shows an empty state instead of the setup steps when the stack keeps its rules in data sources', async () => {
    setGrafanaPromRules([]);
    setupDataSources(MIMIR);
    setPrometheusRules(MIMIR, [
      alertingFactory.prometheus.group.build({ rules: [alertingFactory.prometheus.rule.build()] }),
    ]);

    render(<RevampedHome />);

    expect(await ui.noGrafanaRules.find()).toBeInTheDocument();
    expect(ui.setupHeading.query()).not.toBeInTheDocument();
  });
});

describe('RevampedHome with Grafana-managed rules', () => {
  it('loads the rules again when the overview is refreshed', async () => {
    const requested = jest.fn();
    server.use(
      http.get('/api/prometheus/grafana/api/v1/rules', () => {
        requested();
        return HttpResponse.json({ status: 'success', data: { groups: runningStack } });
      })
    );

    const { user } = render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(requested).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Refresh the alerting overview' }));

    await waitFor(() => expect(requested).toHaveBeenCalledTimes(2));
    expect(await ui.tile('Active rules').find()).toHaveTextContent('Active rules3');
  });

  it('has no time range picker when nothing on the page depends on a range', async () => {
    setGrafanaPromRules(runningStack);

    render(<RevampedHome />);

    expect(await ui.tile('Active rules').find()).toBeInTheDocument();
    expect(screen.queryByLabelText(/time range selected/i)).not.toBeInTheDocument();
    // Refreshing still applies to the current-state numbers.
    expect(screen.getByRole('button', { name: 'Refresh the alerting overview' })).toBeInTheDocument();
  });

  it('requests at most 2,000 rules without alert bodies', async () => {
    const requested = jest.fn();
    server.use(
      http.get('/api/prometheus/grafana/api/v1/rules', ({ request }) => {
        requested(new URL(request.url).search);
        return HttpResponse.json({ status: 'success', data: { groups: runningStack } });
      })
    );

    render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(requested).toHaveBeenCalledWith('?limit_alerts=0&rule_limit=2000');
  });

  it('fills the tiles from the rule totals', async () => {
    setGrafanaPromRules(runningStack);

    render(<RevampedHome />);

    expect(await ui.tile('Active rules').find()).toHaveTextContent('Active rules3');
    expect(ui.tile('Rules failing to evaluate').get()).toHaveTextContent('1');
    expect(ui.tile('Firing instances').get()).toHaveTextContent('Firing instances10');
    expect(ui.tile('Pending instances').get()).toHaveTextContent('Pending instances2');
    expect(ui.tile('Paused rules').get()).toHaveTextContent('Paused rules125% of all rules');
  });

  it('lists the firing rules, most firing first, linking to each rule', async () => {
    setGrafanaPromRules(runningStack);

    render(<RevampedHome />);

    const table = await ui.topFiringRules.find();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['CPU high7', 'Disk full3']);
    expect(within(rows[0]).getByRole('link', { name: 'CPU high' })).toHaveAttribute(
      'href',
      '/alerting/grafana/cpu/view'
    );
  });

  it('says the numbers are partial when the stack has more rules than the page loads', async () => {
    server.use(
      http.get('/api/prometheus/grafana/api/v1/rules', () =>
        HttpResponse.json({ status: 'success', data: { groups: runningStack, groupNextToken: 'more' } })
      )
    );

    render(<RevampedHome />);

    expect(await screen.findByText('Based on the first 2,000 rules.')).toBeInTheDocument();
  });

  it('counts the items that need attention and keeps a dismissed one hidden for this org', async () => {
    setGrafanaPromRules(runningStack);
    setSilences([mockSilence({ id: 'soon', endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })]);

    const { user } = render(<RevampedHome />);

    const attention = await ui.needsAttention.find();
    // runningStack also has 4 instances in error and 1 with no data, which count as problems too.
    expect(await screen.findByText('5 things need attention')).toBeInTheDocument();
    expect(within(attention).getByText('1 rule is failing to evaluate')).toBeInTheDocument();
    expect(within(attention).getByText('4 alert instances are in error')).toBeInTheDocument();
    expect(within(attention).getByText('1 alert instance has no data')).toBeInTheDocument();
    expect(within(attention).getByText('1 rule is paused')).toBeInTheDocument();
    expect(within(attention).getByText('1 silence expires in the next 24 hours')).toBeInTheDocument();

    await user.click(within(attention).getByRole('button', { name: 'Dismiss "1 rule is paused"' }));

    expect(screen.getByText('4 things need attention')).toBeInTheDocument();
    expect(within(attention).queryByText('1 rule is paused')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(getAttentionDismissedKey(config.bootData.user.orgId))!)).toEqual([
      'paused-rules',
    ]);
  });

  it('treats a stack whose instances all have no data as needing attention, not healthy', async () => {
    setGrafanaPromRules([
      mockGrafanaPromRuleGroup({ rules: [mockGrafanaPromAlertingRule({ uid: 'quiet', totals: { nodata: 10 } })] }),
    ]);

    render(<RevampedHome />);

    expect(await screen.findByText('1 thing needs attention')).toBeInTheDocument();
    expect(within(ui.needsAttention.get()).getByText('10 alert instances have no data')).toBeInTheDocument();
    expect(screen.queryByText('Alerting is healthy')).not.toBeInTheDocument();
  });

  it('draws only the states that have instances in the state bar', async () => {
    setGrafanaPromRules(runningStack);

    render(<RevampedHome />);

    expect(
      await screen.findByRole('img', { name: 'Firing 10, Pending 2, Normal 30, No data 1, Error 4' })
    ).toBeInTheDocument();
  });

  it('does not count expired silences as expiring soon', async () => {
    setGrafanaPromRules([mockGrafanaPromRuleGroup({ rules: [mockGrafanaPromAlertingRule({ uid: 'ok' })] })]);
    setSilences([
      mockSilence({ id: 'expired', status: { state: SilenceState.Expired }, endsAt: new Date().toISOString() }),
    ]);

    render(<RevampedHome />);

    expect(await screen.findByText('Alerting is healthy')).toBeInTheDocument();
    expect(ui.tile('Active silences').get()).toHaveTextContent('Active silences00 expire in the next 24 hours');
  });

  it('opens Grafana Assistant with the items that need attention when the Assistant is available', async () => {
    mockUseAssistant.mockReturnValue({ isAvailable: true, openAssistant } as unknown as ReturnType<
      typeof useAssistant
    >);
    setGrafanaPromRules([
      mockGrafanaPromRuleGroup({ rules: [mockGrafanaPromAlertingRule({ uid: 'broken', health: 'error' })] }),
    ]);

    const { user } = render(<RevampedHome />);

    await user.click(await ui.analyzeButton.find());

    expect(openAssistant).toHaveBeenCalledWith({
      origin: 'alerting/home-analyze-stack',
      mode: 'assistant',
      autoSend: true,
      prompt: [
        "Assess the overall health of this stack's Grafana-managed alerting and raise any issues.",
        'Start with these items that need attention and say what to do about each:',
        '- 1 rule is failing to evaluate: Their last evaluation returned an error, so they cannot alert.',
      ].join('\n'),
    });
  });

  it('leaves the Assistant button out when nothing needs attention', async () => {
    mockUseAssistant.mockReturnValue({ isAvailable: true, openAssistant } as unknown as ReturnType<
      typeof useAssistant
    >);
    setGrafanaPromRules([mockGrafanaPromRuleGroup({ rules: [mockGrafanaPromAlertingRule({ uid: 'ok' })] })]);

    render(<RevampedHome />);

    expect(await screen.findByText('Alerting is healthy')).toBeInTheDocument();
    expect(ui.analyzeButton.query()).not.toBeInTheDocument();
  });

  it('points to Alert activity for trends when Grafana Cloud usage metrics are not available', async () => {
    setGrafanaPromRules(runningStack);

    render(<RevampedHome />);

    const trends = await screen.findByRole('region', { name: 'Looking for trends?' });
    expect(within(trends).getByRole('link', { name: 'Alert activity' })).toHaveAttribute('href', '/alerting/alerts');
    expect(screen.queryByRole('tab', { name: 'Rule evaluation' })).not.toBeInTheDocument();
  });

  it('shows an error instead of the overview when the rules cannot be loaded', async () => {
    server.use(
      http.get('/api/prometheus/grafana/api/v1/rules', () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    render(<RevampedHome />);

    expect(await screen.findByText('Could not load Grafana-managed alert rules')).toBeInTheDocument();
    expect(ui.setupHeading.query()).not.toBeInTheDocument();
  });
});

describe('RevampedHome with notification history', () => {
  beforeEach(() => {
    config.unifiedAlerting.notificationHistoryEnabled = true;
    setGrafanaPromRules(runningStack);
  });

  it('shows the delivered share and per-channel delivery, failing channels first', async () => {
    setDeliveryCounts([
      { integration: 'slack', outcome: 'success', count: 990 },
      { integration: 'slack', outcome: 'error', count: 1 },
      { integration: 'pagerduty', outcome: 'success', count: 6 },
      { integration: 'pagerduty', outcome: 'error', count: 3 },
    ]);

    render(<RevampedHome />);

    expect(await screen.findByText('99.60%')).toBeInTheDocument();
    expect(ui.tile('Notifications delivered').get()).toHaveTextContent('1,000 attempts, 4 failed · Last 7 days');

    const rows = within(await ui.deliveryByChannel.find())
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['PagerDuty9333.33%', 'Slack99110.10%']);
    expect(within(ui.needsAttention.get()).getByText('2 channels failed to deliver notifications')).toBeInTheDocument();
  });

  it('queries delivery for the range chosen in the time range picker', async () => {
    const requestedHours = jest.fn();
    server.use(
      http.post(`${HISTORIAN_BASE}/notification/query`, async ({ request }) => {
        const body = (await request.json()) as { from: string; to: string };
        requestedHours(Math.round((Date.parse(body.to) - Date.parse(body.from)) / 3_600_000));
        return HttpResponse.json({
          entries: [],
          counts: [{ integration: 'email', outcome: 'success', count: 5, values: [] }],
        });
      })
    );

    const { user } = render(<RevampedHome />);

    expect(await screen.findByText('5 attempts, 0 failed · Last 7 days')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/time range selected/i));
    await user.click(await screen.findByText('Last 24 hours'));

    expect(await screen.findByText('5 attempts, 0 failed · Last 24 hours')).toBeInTheDocument();
    expect(requestedHours.mock.calls.map(([hours]) => hours)).toEqual([168, 24]);
  });
});
