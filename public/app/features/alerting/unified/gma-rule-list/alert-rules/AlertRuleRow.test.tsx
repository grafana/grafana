import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

const server = setupMswServer();

const LOADING: RuleResourceState<AlertRule> = { status: 'loading' };
const FOLDER_PATH = ['Team Alerts'];

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return {
    uid: 'rule-1',
    title: 'CPU high',
    folderUid: 'folder-1',
    labels: {},
    dataSourceUids: [],
    totals: {},
    ...overrides,
  };
}

function loadedRule(annotations: Record<string, string> = {}): RuleResourceState<AlertRule> {
  return {
    status: 'loaded',
    rule: {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'AlertRule',
      metadata: { name: 'rule-1', annotations },
      spec: { title: 'CPU high', paused: false },
    } as AlertRule,
  };
}

// ALERT-4: the same rule shows the same fields in both modes; only List mode adds the folder
// path. Missing runtime state/health reads Unavailable, never a healthy default.
describe('AlertRuleRow', () => {
  it.each([
    { name: 'firing', props: { state: 'Firing', health: 'OK' }, label: 'Firing' },
    { name: 'errored', props: { state: 'Healthy', health: 'Error' }, label: 'Failed to evaluate rule' },
    { name: 'paused', props: { state: 'Healthy', health: 'OK', paused: true }, label: 'Paused' },
    { name: 'without status', props: {}, label: 'Status unavailable' },
  ])('shows the $name status icon with its accessible name', async ({ props, label }) => {
    render(<AlertRuleRow hit={baseHit(props)} fullRule={LOADING} />);

    expect(await screen.findByLabelText(label)).toBeInTheDocument();
  });

  it('never prints state or health as text', async () => {
    render(<AlertRuleRow hit={baseHit({ state: 'Firing', health: 'Error' })} fullRule={LOADING} />);

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText(/Firing|Error|Unavailable/)).not.toBeInTheDocument();
  });

  it('links the title to the rule view and labels the list item with it', async () => {
    render(
      <ul>
        <AlertRuleRow hit={baseHit()} fullRule={LOADING} />
      </ul>
    );

    expect(await screen.findByRole('link', { name: 'CPU high' })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view'
    );
    expect(screen.getByRole('listitem', { name: 'CPU high' })).toBeInTheDocument();
  });

  it("ALERT-4: shows the rule's own evaluation interval, ahead of the actions", async () => {
    render(<AlertRuleRow hit={baseHit({ interval: '5m' })} fullRule={LOADING} actions={<button>Edit</button>} />);

    const interval = await screen.findByText('5m');
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(interval.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no interval when the search hit has none', async () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} />);

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText(/^\d+[smhd]$/)).not.toBeInTheDocument();
  });

  it('shows the folder path only when fullRule={LOADING} folderPath={FOLDER_PATH} is true', async () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} folderPath={FOLDER_PATH} />);
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

  it('omits the folder path in Folders mode (showFolderPath=false)', () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} />);
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
  });

  it('shows the last error in place of the summary annotation when both are present', () => {
    render(
      <AlertRuleRow hit={baseHit({ lastError: 'connection refused', summary: 'CPU too high' })} fullRule={LOADING} />
    );

    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.queryByText('CPU too high')).not.toBeInTheDocument();
  });

  it('shows the summary when there is no last error', () => {
    render(<AlertRuleRow hit={baseHit({ summary: 'CPU too high' })} fullRule={LOADING} />);

    expect(screen.getByText('CPU too high')).toBeInTheDocument();
  });

  it('orders metadata as folder path, data source, labels, routing', async () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));
    render(
      <AlertRuleRow
        hit={baseHit({ dataSourceUids: ['prom-1'], labels: { team: 'infra' } })}
        fullRule={LOADING}
        folderPath={FOLDER_PATH}
      />
    );

    const folder = await screen.findByText('Team Alerts');
    const dataSource = screen.getByRole('link', { name: 'Prometheus prod' });
    const labels = screen.getByText('1 label');
    const routing = screen.getByText('Default policy');
    const precedes = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(precedes(folder, dataSource)).toBe(true);
    expect(precedes(dataSource, labels)).toBe(true);
    expect(precedes(labels, routing)).toBe(true);
  });

  it('omits label and data source items when the rule has none', () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} />);

    expect(screen.queryByText(/label/)).not.toBeInTheDocument();
    expect(screen.queryByText(/data source/)).not.toBeInTheDocument();
  });

  it('renders one separator fewer than metadata items when labels and data sources are absent', async () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} folderPath={FOLDER_PATH} />);

    // Folder path and routing remain: two items, so exactly one separator.
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.getAllByText('|')).toHaveLength(1);
  });

  it('renders no separator when routing is the only metadata item', async () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} />);

    expect(await screen.findByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByText('|')).not.toBeInTheDocument();
  });

  it('keeps routing visible on a paused rule, because routing is part of the rule definition', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ paused: true, notificationType: 'NamedRoutingTree', routingTree: 'escalation-policy' })}
        fullRule={LOADING}
      />
    );

    expect(screen.getByText('Policy: escalation-policy')).toBeInTheDocument();
  });

  describe('ALERT-10: instance totals', () => {
    it('shows every returned count labelled with its state, including a returned zero, in a fixed order', () => {
      render(
        <AlertRuleRow
          hit={baseHit({ totals: { healthy: 5, firing: 0, pending: 2, recovering: 1, noData: 0, error: 3 } })}
          fullRule={LOADING}
        />
      );

      expect(screen.getByText('5 healthy, 0 firing, 2 pending, 1 recovering, 0 no data, 3 error')).toBeInTheDocument();
    });

    it('omits a total the API did not return instead of showing it as zero', () => {
      render(<AlertRuleRow hit={baseHit({ totals: { firing: 2, error: 1 } })} fullRule={LOADING} />);

      expect(screen.getByText('2 firing, 1 error')).toBeInTheDocument();
      expect(screen.queryByText(/healthy|pending|recovering|no data/)).not.toBeInTheDocument();
    });

    it('shows no instance count and no stray separator for a rule without stored status', async () => {
      render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} />);

      expect(await screen.findByText('Default policy')).toBeInTheDocument();
      expect(screen.queryByText(/healthy|firing|pending|recovering|no data|error/)).not.toBeInTheDocument();
      expect(screen.queryByText('|')).not.toBeInTheDocument();
    });
  });

  describe('plugin and provisioning badges', () => {
    const PLUGIN_SETTINGS_URL = '/api/plugins/my-app/settings';

    beforeEach(() => {
      server.use(
        http.get(PLUGIN_SETTINGS_URL, () =>
          HttpResponse.json({ id: 'my-app', name: 'My App', info: { logos: { small: '/my-app.svg' } } })
        )
      );
    });

    it('ACT-5: shows the plugin badge, resolved by plugin id, for an origin label starting with plugin/', async () => {
      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/my-app' } })} fullRule={LOADING} />);

      expect(await screen.findByRole('img', { name: 'My App' })).toBeInTheDocument();
    });

    it('ACT-5: shows neither badge for an origin label that does not start with plugin/', async () => {
      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'my-app' } })} fullRule={LOADING} />);

      expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'My App' })).not.toBeInTheDocument();
      expect(screen.queryByText('my-app')).not.toBeInTheDocument();
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    });

    // The plugin settings are cached per plugin id, so each fallback case uses an id of its own.
    it('shows the plugin id badge while the plugin settings are loading', async () => {
      server.use(http.get('/api/plugins/slow-app/settings', () => new Promise(() => {})));

      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/slow-app' } })} fullRule={LOADING} />);

      expect(await screen.findByText('slow-app')).toBeInTheDocument();
    });

    it('keeps the plugin id badge when the plugin is not found', async () => {
      server.use(http.get('/api/plugins/missing-app/settings', () => HttpResponse.json({}, { status: 404 })));

      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/missing-app' } })} fullRule={LOADING} />);

      expect(await screen.findByText('missing-app')).toBeInTheDocument();
    });

    it('keeps the plugin id badge when the settings request fails', async () => {
      server.use(http.get('/api/plugins/broken-app/settings', () => HttpResponse.json({}, { status: 500 })));

      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/broken-app' } })} fullRule={LOADING} />);

      expect(await screen.findByText('broken-app')).toBeInTheDocument();
    });

    it('ACT-7: shows the provisioning badge for a managed rule that carries no provenance', () => {
      render(<AlertRuleRow hit={baseHit()} fullRule={loadedRule({ 'grafana.app/managedBy': 'terraform' })} />);

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
    });

    it.each<{ name: string; annotations: Record<string, string>; tooltip: string }>([
      { name: 'Terraform', annotations: { 'grafana.app/managedBy': 'terraform' }, tooltip: 'Provisioned by Terraform' },
      { name: 'Git sync', annotations: { 'grafana.app/managedBy': 'repo' }, tooltip: 'Provisioned by Git sync' },
      {
        name: 'classic file provisioning',
        annotations: { 'grafana.com/provenance': 'file', 'grafana.app/managedBy': 'classic-file-provisioning' },
        tooltip: 'Provisioned via file provisioning',
      },
      {
        name: 'classic API provisioning',
        annotations: { 'grafana.com/provenance': 'api', 'grafana.app/managedBy': 'classic-api-provisioning' },
        tooltip: 'Provisioned via the provisioning API',
      },
      { name: 'no manager properties', annotations: { 'grafana.com/provenance': 'api' }, tooltip: 'Provisioned' },
    ])('ACT-8: the badge tooltip reads "$tooltip" for $name', async ({ annotations, tooltip }) => {
      const { user } = render(<AlertRuleRow hit={baseHit()} fullRule={loadedRule(annotations)} />);
      await user.hover(screen.getByText('Provisioned'));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(new RegExp(`^${tooltip}$`));
    });

    it('shows the plugin badge instead of the provisioning badge for a provisioned plugin rule', async () => {
      render(
        <AlertRuleRow
          hit={baseHit({ labels: { __grafana_origin: 'plugin/my-app' } })}
          fullRule={loadedRule({ 'grafana.com/provenance': 'api' })}
        />
      );

      expect(await screen.findByRole('img', { name: 'My App' })).toBeInTheDocument();
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    });
  });

  it('shows Default policy when no notification type is set', () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING} />);
    expect(screen.getByText('Default policy')).toBeInTheDocument();
  });

  it('shows the direct receiver for SimplifiedRouting', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ notificationType: 'SimplifiedRouting', receiver: 'on-call-team' })}
        fullRule={LOADING}
      />
    );
    expect(screen.getByText('Delivered to')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'on-call-team' })).toHaveAttribute(
      'href',
      '/alerting/notifications?search=on-call-team&tab=contact_points&alertmanager=grafana'
    );
  });

  it('shows the named policy for NamedRoutingTree', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ notificationType: 'NamedRoutingTree', routingTree: 'escalation-policy' })}
        fullRule={LOADING}
      />
    );
    expect(screen.getByText('Policy: escalation-policy')).toBeInTheDocument();
  });

  it('shows the queried data source icon and name', () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));

    render(<AlertRuleRow hit={baseHit({ dataSourceUids: ['prom-1'] })} fullRule={LOADING} />);

    expect(screen.getByRole('link', { name: 'Prometheus prod' })).toBeInTheDocument();
  });

  it('omits the plugin origin label from the label count', async () => {
    render(
      <AlertRuleRow
        hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'plugin/counted-app' } })}
        fullRule={LOADING}
      />
    );

    expect(screen.getByText('1 label')).toBeInTheDocument();
    expect(await screen.findByText('counted-app')).toBeInTheDocument();
  });

  it('counts an origin label that does not mark a plugin rule as an ordinary label', () => {
    render(
      <AlertRuleRow hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'my-app' } })} fullRule={LOADING} />
    );

    expect(screen.getByText('2 labels')).toBeInTheDocument();
  });

  it('shows the provisioning badge once the full rule reports provenance', () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={loadedRule({ 'grafana.com/provenance': 'api' })} />);

    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it.each([{ status: 'loading' }, { status: 'error' }] as const)(
    'shows no provisioning badge while the full rule is $status',
    ({ status }) => {
      render(<AlertRuleRow hit={baseHit()} fullRule={{ status }} />);
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    }
  );
});
