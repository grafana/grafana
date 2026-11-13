import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { useAssistant } from '@grafana/assistant';
import { config, setPluginComponentsHook } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import {
  grantUserPermissions,
  mockDataSource,
  mockGrafanaPromAlertingRule,
  mockGrafanaPromRuleGroup,
} from '../../mocks';
import { setFolderAccessControl, setPrometheusRules } from '../../mocks/server/configure';
import { alertingFactory } from '../../mocks/server/db';
import { HISTORIAN_BASE } from '../../mocks/server/handlers/historian';
import { setupDataSources } from '../../testSetup/datasources';
import {
  failGrafanaRuleSearch,
  setGrafanaSearchRules,
  setGrafanaSearchRulesBeyondTheLimit,
} from '../mocks/rulesSearch';

import RevampedHome from './RevampedHome';
import { getAttentionDismissedKey } from './RunningOverview';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
}));
const mockUseAssistant = jest.mocked(useAssistant);
const openAssistant = jest.fn();

// Scenes panels cannot render in jsdom; the Cloud tests only need the charts to be out of the way.
jest.mock('./DetailsCharts', () => ({
  UsageChart: () => null,
  DeliveryOverTimeChart: () => null,
}));

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
  mostFiredRules: byRole('region', { name: 'Most fired rules' }),
  deliveryByChannel: byRole('region', { name: 'Delivery by channel' }),
  analyzeButton: byRole('button', { name: /analyze with assistant/i }),
};

/** The tiles of the summary row, in the order they are shown. */
function summaryTiles() {
  return within(screen.getByRole('group', { name: 'Alerting summary' }))
    .getAllByRole('region')
    .map((tile) => tile.getAttribute('aria-label'));
}

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
  setNotificationConfig({ contactPoints: 0, nestedPolicies: 0 });
  setupDataSources();
});

afterEach(() => {
  config.unifiedAlerting.notificationHistoryEnabled = notificationHistoryEnabled;
});

describe('RevampedHome shortcuts', () => {
  it('links to the main alerting areas', async () => {
    setGrafanaSearchRules([]);

    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    // The counts arrive with the rules and notification configuration requests.
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
      ['Alert activity', '/alerting/alerts'],
      ['History', '/alerting/history'],
    ]);
  });

  it('counts alert rules with a + when the rules were capped', async () => {
    setGrafanaSearchRulesBeyondTheLimit();

    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    expect(await within(nav).findByRole('link', { name: '2,000+ Alert rules' })).toHaveAttribute(
      'href',
      '/alerting/list'
    );
  });

  it('has no silences shortcut on a self-hosted stack, which has no non-deprecated source for them', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    await within(nav).findByRole('link', { name: '4 Alert rules' });
    expect(within(nav).queryByRole('link', { name: /Silences/ })).not.toBeInTheDocument();
  });

  it('counts contact points and every notification policy, the default one included', async () => {
    setGrafanaSearchRules([]);
    setNotificationConfig({ contactPoints: 3, nestedPolicies: 2 });

    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    expect(await within(nav).findByRole('link', { name: '3 Contact points' })).toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: '3 Notification policies' })).toBeInTheDocument();
  });
});

describe('RevampedHome without Grafana-managed rules', () => {
  it('shows the setup steps in dependency order when no data source holds rules either', async () => {
    setGrafanaSearchRules([]);

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
    setGrafanaSearchRules([]);

    render(<RevampedHome />);

    const steps = within(await ui.setupRegion.find()).getAllByRole('listitem');
    expect(steps.map((step) => within(step).queryByText('Do this next') !== null)).toEqual([true, false, false]);
    expect(within(steps[0]).getByText('Create an alert rule')).toBeInTheDocument();
  });

  it('explains how alerting works, linking each concept to its docs and to the getting started tutorial', async () => {
    setGrafanaSearchRules([]);

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
    setGrafanaSearchRules([]);

    render(<RevampedHome />);

    expect(await ui.setupRegion.find()).toBeInTheDocument();
    expect(screen.queryByLabelText(/time range selected/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh the alerting overview' })).toBeInTheDocument();
  });

  it('shows an empty state instead of the setup steps when the stack keeps its rules in data sources', async () => {
    setGrafanaSearchRules([]);
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
    setGrafanaSearchRules(runningStack, { onSearch: requested });

    const { user } = render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(requested).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Refresh the alerting overview' }));

    await waitFor(() => expect(requested).toHaveBeenCalledTimes(2));
    expect(await ui.tile('Active rules').find()).toHaveTextContent('Active rules3');
  });

  it('has no time range picker when nothing on the page depends on a range', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    expect(await ui.tile('Active rules').find()).toBeInTheDocument();
    expect(screen.queryByLabelText(/time range selected/i)).not.toBeInTheDocument();
    // Refreshing still applies to the current-state numbers.
    expect(screen.getByRole('button', { name: 'Refresh the alerting overview' })).toBeInTheDocument();
  });

  it('fills the tiles from the rule totals', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    expect(await ui.tile('Active rules').find()).toHaveTextContent('Active rules375% of all rules');
    expect(ui.tile('Evaluations succeeding').get()).toHaveTextContent(
      'Evaluations succeeding66.67%2 of 3 rules, last evaluation'
    );
    expect(ui.tile('Firing instances').get()).toHaveTextContent('Firing instances10');
    expect(ui.tile('Pending instances').get()).toHaveTextContent('Pending instances2');
    expect(ui.tile('Paused rules').get()).toHaveTextContent('Paused rules125% of all rules');
    // Without usage metrics there is no history, so no tile draws a trend.
    expect(screen.queryByRole('img', { name: /^Trend over/ })).not.toBeInTheDocument();
  });

  it('shows five tiles, with no silences tile, on a self-hosted stack without notification history', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(summaryTiles()).toEqual([
      'Active rules',
      'Evaluations succeeding',
      'Firing instances',
      'Pending instances',
      'Paused rules',
    ]);
  });

  it('lists the firing rules, most firing first, linking to each rule', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const table = await ui.topFiringRules.find();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['CPU high7', 'Disk full3']);
    expect(within(rows[0]).getByRole('link', { name: 'CPU high' })).toHaveAttribute(
      'href',
      '/alerting/grafana/cpu/view'
    );
  });

  it('offers to silence or edit each firing rule when the user may do both', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingInstanceRead,
      AccessControlAction.AlertingInstanceCreate,
    ]);
    // Editing is checked against the rule's folder.
    setFolderAccessControl({ [AccessControlAction.AlertingRuleUpdate]: true });
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const table = await ui.topFiringRules.find();
    const [cpuRow] = within(table).getAllByRole('row').slice(1);
    expect(await within(cpuRow).findByRole('link', { name: 'Silence' })).toHaveAttribute(
      'href',
      '/alerting/silence/new?alertmanager=grafana&matcher=__alert_rule_uid__%3Dcpu'
    );
    expect(await within(cpuRow).findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/alerting/cpu/edit');
  });

  it('shows only Silence when the user may silence rules but not edit them', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingInstanceRead,
      AccessControlAction.AlertingInstanceCreate,
    ]);
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const [cpuRow] = within(await ui.topFiringRules.find())
      .getAllByRole('row')
      .slice(1);
    expect(await within(cpuRow).findByRole('link', { name: 'Silence' })).toBeInTheDocument();
    expect(within(cpuRow).queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows only Edit when the user may edit rules in the folder but not silence them', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingInstanceRead,
    ]);
    setFolderAccessControl({ [AccessControlAction.AlertingRuleUpdate]: true });
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const [cpuRow] = within(await ui.topFiringRules.find())
      .getAllByRole('row')
      .slice(1);
    expect(await within(cpuRow).findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/alerting/cpu/edit');
    expect(within(cpuRow).queryByRole('link', { name: 'Silence' })).not.toBeInTheDocument();
  });

  it('leaves out the silence and edit actions for a user who may only read', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceRead]);
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const table = await ui.topFiringRules.find();
    expect(within(table).getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: 'Silence' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('points to Alert activity as the place to learn more about firing instances', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const callout = await screen.findByRole('region', { name: 'Alert activity' });
    expect(callout).toHaveTextContent(
      'Alert activity lists every firing and pending alert instance, with its labels and how long it has been firing.'
    );
    expect(within(callout).getByRole('link', { name: 'Open alert activity' })).toHaveAttribute(
      'href',
      '/alerting/alerts'
    );
  });

  it('says rule status is missing, instead of showing zeros, when the stack does not report it', async () => {
    setGrafanaSearchRules(runningStack, { withStatus: false });

    render(<RevampedHome />);

    const note = await screen.findByRole('alert', { name: /does not report rule status/i });
    expect(note).toHaveTextContent('Rule health and alert instance counts are empty, not zero, so they are left out.');
    expect(ui.tile('Active rules').get()).toHaveTextContent('Active rules3');
    // Counts that need rule status are left out, so they cannot read as zero.
    expect(ui.tile('Firing instances').query()).not.toBeInTheDocument();
    expect(ui.tile('Pending instances').query()).not.toBeInTheDocument();
    expect(ui.tile('Evaluations succeeding').query()).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Alert instances by state' })).not.toBeInTheDocument();
    expect(ui.topFiringRules.query()).not.toBeInTheDocument();
    // What does not need status stays.
    expect(ui.tile('Paused rules').get()).toHaveTextContent('Paused rules125% of all rules');
  });

  it('leaves out the missing status note when the stack reports rule status', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(screen.queryByText(/does not report rule status/i)).not.toBeInTheDocument();
  });

  it('says the numbers are partial when the stack has more rules than the page loads', async () => {
    setGrafanaSearchRulesBeyondTheLimit();

    render(<RevampedHome />);

    expect(await screen.findByText('Based on the first 2,000 rules.')).toBeInTheDocument();
  });

  it('counts the items that need attention and keeps a dismissed one hidden for this org', async () => {
    setGrafanaSearchRules(runningStack);

    const { user } = render(<RevampedHome />);

    const attention = await ui.needsAttention.find();
    // runningStack also has 4 instances in error and 1 with no data, which count as problems too.
    expect(await screen.findByText('4 things need attention')).toBeInTheDocument();
    expect(within(attention).getByText('1 rule is failing to evaluate')).toBeInTheDocument();
    expect(within(attention).getByText('4 alert instances are in error')).toBeInTheDocument();
    expect(within(attention).getByText('1 alert instance has no data')).toBeInTheDocument();
    expect(within(attention).getByText('1 rule is paused')).toBeInTheDocument();
    expect(within(attention).queryByText(/silence/i)).not.toBeInTheDocument();

    await user.click(within(attention).getByRole('button', { name: 'Dismiss "1 rule is paused"' }));

    expect(screen.getByText('3 things need attention')).toBeInTheDocument();
    expect(within(attention).queryByText('1 rule is paused')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(getAttentionDismissedKey(config.bootData.user.orgId))!)).toEqual([
      'paused-rules',
    ]);
  });

  it('treats a stack whose instances all have no data as needing attention, not healthy', async () => {
    setGrafanaSearchRules([
      mockGrafanaPromRuleGroup({ rules: [mockGrafanaPromAlertingRule({ uid: 'quiet', totals: { nodata: 10 } })] }),
    ]);

    render(<RevampedHome />);

    expect(await screen.findByText('1 thing needs attention')).toBeInTheDocument();
    expect(within(ui.needsAttention.get()).getByText('10 alert instances have no data')).toBeInTheDocument();
    expect(screen.queryByText('Alerting is healthy')).not.toBeInTheDocument();
  });

  it('draws only the states that have instances in the state bar', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    expect(
      await screen.findByRole('img', { name: 'Firing 10, Pending 2, No data 1, Error 4, Normal 30' })
    ).toBeInTheDocument();
  });

  it('lists the states in the order firing, pending, recovering, no data, error, normal', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const instances = await screen.findByRole('region', { name: 'Alert instances by state' });
    expect(
      within(instances)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Firing 10', 'Pending 2', 'Recovering 0', 'No data 1', 'Error 4', 'Normal 30']);
  });

  it('opens Grafana Assistant with the items that need attention when the Assistant is available', async () => {
    mockUseAssistant.mockReturnValue({ isAvailable: true, openAssistant } as unknown as ReturnType<
      typeof useAssistant
    >);
    setGrafanaSearchRules([
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
    setGrafanaSearchRules([mockGrafanaPromRuleGroup({ rules: [mockGrafanaPromAlertingRule({ uid: 'ok' })] })]);

    render(<RevampedHome />);

    expect(await screen.findByText('Alerting is healthy')).toBeInTheDocument();
    expect(ui.analyzeButton.query()).not.toBeInTheDocument();
  });

  it('points to Alert activity for trends when Grafana Cloud usage metrics are not available', async () => {
    setGrafanaSearchRules(runningStack);

    render(<RevampedHome />);

    const trends = await screen.findByRole('region', { name: 'Looking for trends?' });
    expect(within(trends).getByRole('link', { name: 'Alert activity' })).toHaveAttribute('href', '/alerting/alerts');
    expect(screen.queryByRole('tab', { name: 'Rule evaluation' })).not.toBeInTheDocument();
  });

  it('shows an error instead of the overview when the rules cannot be loaded', async () => {
    failGrafanaRuleSearch();

    render(<RevampedHome />);

    expect(await screen.findByText('Could not load Grafana-managed alert rules')).toBeInTheDocument();
    expect(ui.setupHeading.query()).not.toBeInTheDocument();
  });
});

describe('RevampedHome with notification history', () => {
  beforeEach(() => {
    config.unifiedAlerting.notificationHistoryEnabled = true;
    setGrafanaSearchRules(runningStack);
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
    expect(ui.tile('Notifications delivered').get()).toHaveTextContent('1,000 sent, 4 failed, last 7d');

    const rows = within(await ui.deliveryByChannel.find())
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['PagerDuty9366.67%', 'Slack991199.90%']);
    expect(within(ui.needsAttention.get()).getByText('2 channels failed to deliver notifications')).toBeInTheDocument();
  });

  it('puts Notifications delivered in the third place of the six self-hosted tiles', async () => {
    setDeliveryCounts([{ integration: 'slack', outcome: 'success', count: 10 }]);

    render(<RevampedHome />);

    await ui.tile('Notifications delivered').find();
    expect(summaryTiles()).toEqual([
      'Active rules',
      'Evaluations succeeding',
      'Notifications delivered',
      'Firing instances',
      'Pending instances',
      'Paused rules',
    ]);
  });

  it('draws the delivered share over time in the Notifications delivered tile', async () => {
    const requestedTypes = jest.fn();
    server.use(
      http.post(`${HISTORIAN_BASE}/notification/query`, async ({ request }) => {
        const body = (await request.json()) as { type: string; step?: number };
        requestedTypes(body.type, body.step);
        return HttpResponse.json({
          entries: [],
          counts:
            body.type === 'range_counts'
              ? [
                  {
                    outcome: 'success',
                    count: 0,
                    values: [
                      { timestamp: 1, count: 9 },
                      { timestamp: 2, count: 10 },
                    ],
                  },
                ]
              : [{ integration: 'email', outcome: 'success', count: 19, values: [] }],
        });
      })
    );

    render(<RevampedHome />);

    const tile = await ui.tile('Notifications delivered').find();
    expect(await within(tile).findByRole('img', { name: 'Trend over Last 7 days' })).toBeInTheDocument();
    expect(requestedTypes).toHaveBeenCalledWith('range_counts', 10080);
  });

  it('colours each channel by its success rate: green from 99.5%, yellow from 98%, red below, failed count alike', async () => {
    setDeliveryCounts([
      { integration: 'email', outcome: 'success', count: 1000 },
      { integration: 'slack', outcome: 'success', count: 985 },
      { integration: 'slack', outcome: 'error', count: 15 },
      { integration: 'webhook', outcome: 'success', count: 90 },
      { integration: 'webhook', outcome: 'error', count: 10 },
    ]);

    render(<RevampedHome />);

    const rows = within(await ui.deliveryByChannel.find())
      .getAllByRole('row')
      .slice(1);
    const { success, warning, error } = config.theme2.colors;
    // Sorted by failed attempts: slack 98.50%, webhook 90.00%, email 100.00%.
    expect(rows.map((row) => row.textContent)).toEqual([
      'slack1,0001598.50%',
      'webhook1001090.00%',
      'email1,0000100.00%',
    ]);
    const [slack, webhook, email] = rows.map((row) => within(row).getAllByRole('cell'));
    // Accessible cells: name, attempts, failed, success rate (the dot and bar are hidden).
    for (const [cells, color] of [
      [webhook, error.text],
      [slack, warning.text],
      [email, success.text],
    ] as const) {
      expect(cells[2]).toHaveStyle({ color });
      expect(cells[3]).toHaveStyle({ color });
    }
  });

  it('queries delivery for the range chosen in the time range picker', async () => {
    const requestedHours = jest.fn();
    server.use(
      http.post(`${HISTORIAN_BASE}/notification/query`, async ({ request }) => {
        const body = (await request.json()) as { from: string; to: string; type: string };
        // The delivered tile also asks for a time series; only the totals depend on the range here.
        if (body.type === 'counts') {
          requestedHours(Math.round((Date.parse(body.to) - Date.parse(body.from)) / 3_600_000));
        }
        return HttpResponse.json({
          entries: [],
          counts: [{ integration: 'email', outcome: 'success', count: 5, values: [] }],
        });
      })
    );

    const { user } = render(<RevampedHome />);

    expect(await screen.findByText('5 sent, 0 failed, last 7d')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/time range selected/i));
    await user.click(await screen.findByText('Last 24 hours'));

    expect(await screen.findByText('5 sent, 0 failed, last 24h')).toBeInTheDocument();
    expect(requestedHours.mock.calls.map(([hours]) => hours)).toEqual([168, 24]);
  });
});

const USAGE = mockDataSource({ name: 'grafanacloud-usage', uid: 'grafanacloud-usage', type: 'prometheus' });
const STATE_HISTORY = mockDataSource({
  name: 'grafanacloud-alert-state-history',
  uid: 'grafanacloud-alert-state-history',
  type: 'loki',
});

/** A data frame the way /api/ds/query returns one series. */
function frame(values: number[], labels: Record<string, string> = {}) {
  return {
    schema: {
      fields: [
        { name: 'Time', type: 'time' },
        { name: 'Value', type: 'number', labels },
      ],
    },
    data: { values: [values.map((_, index) => index * 60_000), values] },
  };
}

function setDataSourceQueries(framesByRefId: Record<string, Array<ReturnType<typeof frame>>>) {
  server.use(
    http.post('/api/ds/query', async ({ request }) => {
      const body = (await request.json()) as { queries: Array<{ refId: string }> };
      return HttpResponse.json({
        results: Object.fromEntries(
          body.queries.map(({ refId }) => [refId, { status: 200, frames: framesByRefId[refId] ?? [] }])
        ),
      });
    })
  );
}

describe('RevampedHome with Grafana Cloud usage metrics', () => {
  beforeEach(() => {
    setupDataSources(USAGE, STATE_HISTORY);
    setGrafanaSearchRules(runningStack);
    setDataSourceQueries({
      activeRules: [frame([2, 3])],
      pausedRules: [frame([1, 1])],
      firing: [frame([4, 10])],
      pending: [frame([0, 2])],
      // Per-second rates: 10 evaluations a second, one failing in the first step.
      evaluations: [frame([10, 10])],
      failures: [frame([1, 0])],
      silences: [frame([4, 4], { state: 'active' }), frame([9, 9], { state: 'expired' })],
      mostFired: [
        frame([12], { labels_alertname: 'Disk full', ruleUID: 'disk' }),
        frame([40], { labels_alertname: 'CPU high', ruleUID: 'cpu' }),
      ],
      firingTrend: [frame([10, 30], { ruleUID: 'cpu' }), frame([5, 7], { ruleUID: 'disk' })],
    });
  });

  it('shows the share of successful evaluations over the range, from the usage metrics', async () => {
    render(<RevampedHome />);

    // 7 days in about 60 steps is 10,080 seconds a step: 201,600 evaluations, 10,080 of them failed.
    const tile = ui.tile('Evaluations succeeding');
    await waitFor(() =>
      expect(tile.get()).toHaveTextContent('Evaluations succeeding95.00%191.5k succeeded, 10,080 failed, last 7d')
    );
  });

  it('counts active silences from the usage metrics, since there is no other source for them', async () => {
    render(<RevampedHome />);

    const nav = await screen.findByRole('navigation', { name: 'Alerting areas' });
    expect(await within(nav).findByRole('link', { name: '4 Silences' })).toHaveAttribute('href', '/alerting/silences');
  });

  it('shows exactly four tiles in a single row: active rules, paused rules, evaluations, notifications', async () => {
    render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(summaryTiles()).toEqual([
      'Active rules',
      'Paused rules',
      'Evaluations succeeding',
      'Notifications delivered',
    ]);
  });

  it('shows the share of rules that are active and paused, out of all of them', async () => {
    render(<RevampedHome />);

    // The stack has 3 active and 1 paused rule.
    expect(await ui.tile('Active rules').find()).toHaveTextContent('Active rules375% of all rules, evaluating now');
    expect(ui.tile('Paused rules').get()).toHaveTextContent('Paused rules125% of all rules');
  });

  it('takes the firing and pending tiles out of the row but keeps their states in the instances chart', async () => {
    render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(ui.tile('Firing instances').query()).not.toBeInTheDocument();
    expect(ui.tile('Pending instances').query()).not.toBeInTheDocument();
    const instances = screen.getByRole('region', { name: 'Alert instances by state' });
    expect(within(instances).getByText('Firing')).toBeInTheDocument();
    expect(within(instances).getByText('Pending')).toBeInTheDocument();
  });

  it('draws a trend in each tile that has history', async () => {
    render(<RevampedHome />);

    await waitFor(() =>
      expect(
        within(ui.tile('Active rules').get()).getByRole('img', { name: 'Trend over Last 7 days' })
      ).toBeInTheDocument()
    );
    for (const name of ['Paused rules', 'Evaluations succeeding']) {
      expect(within(ui.tile(name).get()).getByRole('img', { name: 'Trend over Last 7 days' })).toBeInTheDocument();
    }
  });

  it('keeps the notifications tile, with a dash, when notification history is off', async () => {
    render(<RevampedHome />);

    await ui.tile('Active rules').find();
    expect(ui.tile('Notifications delivered').get()).toHaveTextContent('Notifications delivered–');
    expect(ui.tile('Active silences').query()).not.toBeInTheDocument();
  });

  it('shows the rules firing now when none of them fired anew in the range', async () => {
    // A rule that has been firing since before the range has no state change in it, so no times fired.
    setDataSourceQueries({ mostFired: [], firingTrend: [] });

    render(<RevampedHome />);

    const table = await ui.topFiringRules.find();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['CPU high7', 'Disk full3']);
    expect(ui.mostFiredRules.query()).not.toBeInTheDocument();
  });

  it('lists the most fired rules over the range with a trend for each, instead of the rules firing now', async () => {
    render(<RevampedHome />);

    const table = await ui.mostFiredRules.find();
    const rows = await within(table).findAllByRole('row');
    expect(rows.slice(1).map((row) => row.textContent)).toEqual(['CPU high40', 'Disk full12']);
    expect(within(rows[1]).getByRole('link', { name: 'CPU high' })).toHaveAttribute(
      'href',
      '/alerting/grafana/cpu/view'
    );
    expect(within(rows[1]).getByRole('img', { name: 'Trend over Last 7 days' })).toBeInTheDocument();
    expect(ui.topFiringRules.query()).not.toBeInTheDocument();
  });
});

describe('RevampedHome with alert state history in Loki on a self-hosted stack', () => {
  const stateHistory = config.unifiedAlerting.stateHistory;

  beforeEach(() => {
    config.unifiedAlerting.stateHistory = { ...stateHistory, backend: 'loki' };
    setGrafanaSearchRules(runningStack);
  });

  afterEach(() => {
    config.unifiedAlerting.stateHistory = stateHistory;
  });

  it('ranks rules by how often they fired in the range, from state history, with a trend for each', async () => {
    const requested = jest.fn();
    const now = Date.now();
    const events = [
      { time: now - 3_600_000, ruleUID: 'cpu', ruleTitle: 'CPU high' },
      { time: now - 60_000, ruleUID: 'cpu', ruleTitle: 'CPU high' },
      { time: now - 120_000, ruleUID: 'disk', ruleTitle: 'Disk full' },
    ];
    server.use(
      http.get(`${HISTORIAN_BASE}/alertstate/history`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requested({ current: params.get('current'), limit: params.get('limit') });
        return HttpResponse.json({
          data: {
            values: [
              events.map((event) => event.time),
              events.map(({ ruleUID, ruleTitle }) => ({ ruleUID, ruleTitle, current: 'Alerting', previous: 'Normal' })),
              events.map(() => ({})),
            ],
          },
        });
      })
    );

    render(<RevampedHome />);

    const table = await ui.mostFiredRules.find();
    const rows = (await within(table).findAllByRole('row')).slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['CPU high2', 'Disk full1']);
    expect(within(rows[0]).getByRole('img', { name: 'Trend over Last 7 days' })).toBeInTheDocument();
    expect(requested).toHaveBeenCalledWith({ current: 'Alerting', limit: '5000' });
    expect(ui.topFiringRules.query()).not.toBeInTheDocument();
  });

  it('shows the rules firing now when the stack has no alert state handler for the historian API', async () => {
    server.use(
      http.get(`${HISTORIAN_BASE}/alertstate/history`, () =>
        HttpResponse.json({ message: 'no alert state handler' }, { status: 422 })
      )
    );

    render(<RevampedHome />);

    const table = await ui.topFiringRules.find();
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(['CPU high7', 'Disk full3']);
    expect(ui.mostFiredRules.query()).not.toBeInTheDocument();
  });
});
