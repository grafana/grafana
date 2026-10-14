import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

const server = setupMswServer();

const ALERT_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/:name';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';

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

function mockFullRule(spec: Record<string, unknown> = {}) {
  server.use(
    http.get(ALERT_RULE_GET_URL, ({ params }) =>
      HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: 'AlertRule',
        metadata: { name: params.name, annotations: {} },
        spec: { title: 'CPU high', paused: false, ...spec },
      })
    )
  );
}

// ALERT-4: the same rule shows the same fields in both modes; only List mode adds the folder
// path. Missing runtime state/health reads Unavailable, never a healthy default.
describe('AlertRuleRow', () => {
  beforeEach(() => {
    mockFullRule();
    server.use(
      http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ items: [{ name: 'folder-1', title: 'Team Alerts' }] }))
    );
  });

  it.each([
    { name: 'firing', props: { state: 'Firing', health: 'OK' }, label: 'Firing' },
    { name: 'errored', props: { state: 'Healthy', health: 'Error' }, label: 'Failed to evaluate rule' },
    { name: 'paused', props: { state: 'Healthy', health: 'OK', paused: true }, label: 'Paused' },
    { name: 'without status', props: {}, label: 'Status unavailable' },
  ])('shows the $name status icon with its accessible name', async ({ props, label }) => {
    render(<AlertRuleRow hit={baseHit(props)} showFolderPath={false} />);

    expect(await screen.findByLabelText(label)).toBeInTheDocument();
  });

  it('never prints state or health as text', async () => {
    render(<AlertRuleRow hit={baseHit({ state: 'Firing', health: 'Error' })} showFolderPath={false} />);

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText(/Firing|Error|Unavailable/)).not.toBeInTheDocument();
  });

  it('links the title to the rule view and labels the list item with it', async () => {
    render(
      <ul>
        <AlertRuleRow hit={baseHit()} showFolderPath={false} />
      </ul>
    );

    expect(await screen.findByRole('link', { name: 'CPU high' })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view'
    );
    expect(screen.getByRole('listitem', { name: 'CPU high' })).toBeInTheDocument();
  });

  it("ALERT-4: shows the rule's own evaluation interval, ahead of the actions", async () => {
    render(<AlertRuleRow hit={baseHit({ interval: '5m' })} showFolderPath={false} actions={<button>Edit</button>} />);

    const interval = await screen.findByText('5m');
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(interval.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no interval when the search hit has none', async () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText(/^\d+[smhd]$/)).not.toBeInTheDocument();
  });

  it('shows the folder path only when showFolderPath is true', async () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath />);
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

  it('omits the folder path in Folders mode (showFolderPath=false)', () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
  });

  it('shows the last error in place of the summary annotation when both are present', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ lastError: 'connection refused', summary: 'CPU too high' })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.queryByText('CPU too high')).not.toBeInTheDocument();
  });

  it('shows the summary when there is no last error', () => {
    render(<AlertRuleRow hit={baseHit({ summary: 'CPU too high' })} showFolderPath={false} />);

    expect(screen.getByText('CPU too high')).toBeInTheDocument();
  });

  it('orders metadata as folder path, data source, labels, routing', async () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));
    render(<AlertRuleRow hit={baseHit({ dataSourceUids: ['prom-1'], labels: { team: 'infra' } })} showFolderPath />);

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
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

    expect(screen.queryByText(/label/)).not.toBeInTheDocument();
    expect(screen.queryByText(/data source/)).not.toBeInTheDocument();
  });

  it('renders one separator fewer than metadata items when labels and data sources are absent', async () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath />);

    // Folder path and routing remain: two items, so exactly one separator.
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.getAllByText('|')).toHaveLength(1);
  });

  it('renders no separator when routing is the only metadata item', async () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

    expect(await screen.findByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByText('|')).not.toBeInTheDocument();
  });

  it('keeps routing visible on a paused rule, because routing is part of the rule definition', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ paused: true, notificationType: 'NamedRoutingTree', routingTree: 'escalation-policy' })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('Policy: escalation-policy')).toBeInTheDocument();
  });

  describe('ALERT-10: instance totals', () => {
    it('shows every returned count labelled with its state, including a returned zero, in a fixed order', () => {
      render(
        <AlertRuleRow
          hit={baseHit({ totals: { healthy: 5, firing: 0, pending: 2, recovering: 1, noData: 0, error: 3 } })}
          showFolderPath={false}
        />
      );

      expect(screen.getByText('5 healthy, 0 firing, 2 pending, 1 recovering, 0 no data, 3 error')).toBeInTheDocument();
    });

    it('omits a total the API did not return instead of showing it as zero', () => {
      render(<AlertRuleRow hit={baseHit({ totals: { firing: 2, error: 1 } })} showFolderPath={false} />);

      expect(screen.getByText('2 firing, 1 error')).toBeInTheDocument();
      expect(screen.queryByText(/healthy|pending|recovering|no data/)).not.toBeInTheDocument();
    });

    it('shows no instance count and no stray separator for a rule without stored status', async () => {
      render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

      expect(await screen.findByText('Default policy')).toBeInTheDocument();
      expect(screen.queryByText(/healthy|firing|pending|recovering|no data|error/)).not.toBeInTheDocument();
      expect(screen.queryByText('|')).not.toBeInTheDocument();
    });
  });

  describe('plugin and provisioning badges', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/plugins/my-app/settings', () =>
          HttpResponse.json({ id: 'my-app', name: 'My App', info: { logos: { small: '/my-app.svg' } } })
        )
      );
    });

    it('ACT-5: shows the plugin badge, resolved by plugin id, for an origin label starting with plugin/', async () => {
      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/my-app' } })} showFolderPath={false} />);

      expect(await screen.findByRole('img', { name: 'My App' })).toBeInTheDocument();
    });

    it('ACT-5: shows neither badge for an origin label that does not start with plugin/', async () => {
      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'my-app' } })} showFolderPath={false} />);

      expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'My App' })).not.toBeInTheDocument();
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    });

    it('ACT-7: shows the provisioning badge for a managed rule that carries no provenance', async () => {
      server.use(
        http.get(ALERT_RULE_GET_URL, ({ params }) =>
          HttpResponse.json({
            apiVersion: 'v0alpha1',
            kind: 'AlertRule',
            metadata: { name: params.name, annotations: { 'grafana.app/managedBy': 'terraform' } },
            spec: { title: 'CPU high', paused: false },
          })
        )
      );

      render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

      expect(await screen.findByText('Provisioned')).toBeInTheDocument();
    });

    it.each([
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
      server.use(
        http.get(ALERT_RULE_GET_URL, ({ params }) =>
          HttpResponse.json({
            apiVersion: 'v0alpha1',
            kind: 'AlertRule',
            metadata: { name: params.name, annotations },
            spec: { title: 'CPU high', paused: false },
          })
        )
      );

      const { user } = render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);
      await user.hover(await screen.findByText('Provisioned'));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(new RegExp(`^${tooltip}$`));
    });

    it('shows the plugin badge instead of the provisioning badge for a provisioned plugin rule', async () => {
      server.use(
        http.get(ALERT_RULE_GET_URL, ({ params }) =>
          HttpResponse.json({
            apiVersion: 'v0alpha1',
            kind: 'AlertRule',
            metadata: { name: params.name, annotations: { 'grafana.com/provenance': 'api' } },
            spec: { title: 'CPU high', paused: false },
          })
        )
      );

      render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/my-app' } })} showFolderPath={false} />);

      expect(await screen.findByRole('img', { name: 'My App' })).toBeInTheDocument();
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    });
  });

  it('shows Default policy when no notification type is set', () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.getByText('Default policy')).toBeInTheDocument();
  });

  it('shows the direct receiver for SimplifiedRouting', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ notificationType: 'SimplifiedRouting', receiver: 'on-call-team' })}
        showFolderPath={false}
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
        showFolderPath={false}
      />
    );
    expect(screen.getByText('Policy: escalation-policy')).toBeInTheDocument();
  });

  it('shows the queried data source icon and name', () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));

    render(<AlertRuleRow hit={baseHit({ dataSourceUids: ['prom-1'] })} showFolderPath={false} />);

    expect(screen.getByRole('link', { name: 'Prometheus prod' })).toBeInTheDocument();
  });

  it('shows the label count and omits __grafana_origin from it', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'my-plugin' } })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('shows the provisioning badge once the full rule loads and reports provenance', async () => {
    mockFullRule();
    server.use(
      http.get(ALERT_RULE_GET_URL, ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'AlertRule',
          metadata: { name: params.name, annotations: { 'grafana.com/provenance': 'api' } },
          spec: { title: 'CPU high', paused: false },
        })
      )
    );

    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no provisioning badge while the full rule is still loading', () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
