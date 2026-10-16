import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

const server = setupMswServer();

const LOADING: RuleResourceState<RecordingRule> = { status: 'loading' };
const FOLDER_PATH = ['Platform', 'Team Alerts'];

function baseHit(overrides: Partial<RecordingRuleSearchHit> = {}): RecordingRuleSearchHit {
  return {
    uid: 'rule-1',
    title: 'cpu_usage:avg',
    folderUid: 'folder-1',
    labels: {},
    dataSourceUids: [],
    ...overrides,
  };
}

function loadedRule(annotations: Record<string, string> = {}): RuleResourceState<RecordingRule> {
  return {
    status: 'loaded',
    rule: {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'RecordingRule',
      metadata: { name: 'rule-1', annotations },
      spec: { title: 'cpu_usage:avg', paused: false },
    } as RecordingRule,
  };
}

interface ManagerCase {
  name: string;
  annotations: Record<string, string>;
  tooltip: string;
}

describe('RecordingRuleRow', () => {
  beforeEach(() => {
    setupDataSources(
      mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }),
      mockDataSource({ uid: 'loki-1', name: 'Loki prod' })
    );
  });

  it('labels the row by its title link', () => {
    render(<RecordingRuleRow hit={baseHit()} fullRule={LOADING} />);
    const link = screen.getByRole('link', { name: 'cpu_usage:avg' });
    expect(link).toHaveAttribute('href', '/alerting/grafana/rule-1/view');
    expect(screen.getByRole('listitem', { name: 'cpu_usage:avg' })).toBeInTheDocument();
  });

  it.each([
    { name: 'Recording health', props: { health: 'Recording' }, label: 'Recording' },
    { name: 'Error health', props: { health: 'Error' }, label: 'Failed to evaluate rule' },
    { name: 'paused', props: { health: 'Recording', paused: true }, label: 'Paused' },
    { name: 'missing status', props: {}, label: 'Status unavailable' },
  ])('shows the "$label" status icon for $name', ({ props, label }) => {
    render(<RecordingRuleRow hit={baseHit(props)} fullRule={LOADING} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('never prints health or paused as text', () => {
    render(<RecordingRuleRow hit={baseHit({ health: 'Recording', paused: true })} fullRule={LOADING} />);
    expect(screen.getByLabelText('Paused')).toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
  });

  it("REC-3: shows the rule's own evaluation interval, ahead of the actions", () => {
    render(<RecordingRuleRow hit={baseHit({ interval: '5m' })} fullRule={LOADING} actions={<button>Edit</button>} />);

    const interval = screen.getByText('5m');
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(interval.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names the interval chip and explains it in a tooltip', async () => {
    const { user } = render(<RecordingRuleRow hit={baseHit({ interval: '10m' })} fullRule={LOADING} />);

    const chip = await screen.findByRole('img', { name: 'Evaluated every 10m' });
    await user.hover(chip);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Evaluated every 10m');
  });

  it('shows no interval when the search hit has none', () => {
    render(<RecordingRuleRow hit={baseHit()} fullRule={LOADING} />);

    expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
    expect(screen.queryByText(/^\d+[smhd]$/)).not.toBeInTheDocument();
  });

  it('shows no description line when there is no error, even when the rule records a metric', () => {
    render(
      <RecordingRuleRow
        hit={baseHit({ metric: 'cpu_usage:avg', targetDataSourceUid: 'prom-1' })}
        fullRule={LOADING}
        folderPath={FOLDER_PATH}
      />
    );

    const row = screen.getByRole('listitem');
    expect(row.querySelectorAll('p')).toHaveLength(0);
    expect(screen.getAllByTestId('rule-meta-item')).toHaveLength(2);
  });

  it('shows the last error as the description', () => {
    render(<RecordingRuleRow hit={baseHit({ lastError: 'query timed out' })} fullRule={LOADING} />);

    expect(screen.getByText('query timed out')).toBeInTheDocument();
  });

  describe('Records ... to ...', () => {
    it('is metadata item 2, after the folder path and before the queried data sources, with or without an error', () => {
      render(
        <RecordingRuleRow
          hit={baseHit({
            lastError: 'query timed out',
            metric: 'cpu_usage:avg',
            targetDataSourceUid: 'prom-1',
            dataSourceUids: ['loki-1'],
          })}
          fullRule={LOADING}
          folderPath={FOLDER_PATH}
        />
      );

      const folder = screen.getByText('Team Alerts');
      const records = screen.getByText('Records cpu_usage:avg to');
      const queried = screen.getByRole('link', { name: 'Loki prod' });
      const precedes = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(precedes(folder, records)).toBe(true);
      expect(precedes(records, queried)).toBe(true);
    });

    it('places the target logo and name after "to"', () => {
      render(
        <RecordingRuleRow
          hit={baseHit({ metric: 'cpu_usage:avg', targetDataSourceUid: 'prom-1' })}
          fullRule={LOADING}
        />
      );

      const to = screen.getByText('Records cpu_usage:avg to');
      const name = screen.getByText('Prometheus prod');
      expect(to.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('names only the target when the metric is unknown', () => {
      render(<RecordingRuleRow hit={baseHit({ targetDataSourceUid: 'prom-1' })} fullRule={LOADING} />);

      expect(screen.getByText('Records to')).toBeInTheDocument();
      expect(screen.getByText('Prometheus prod')).toBeInTheDocument();
    });

    it('names only the metric when the target data source cannot be resolved', () => {
      render(
        <RecordingRuleRow hit={baseHit({ metric: 'cpu_usage:avg', targetDataSourceUid: 'gone' })} fullRule={LOADING} />
      );

      expect(screen.getByText('Records cpu_usage:avg')).toBeInTheDocument();
    });

    it('is omitted when neither metric nor a resolvable target is known', () => {
      render(<RecordingRuleRow hit={baseHit({ targetDataSourceUid: 'gone' })} fullRule={LOADING} />);

      expect(screen.queryByText(/Records/)).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('rule-meta-item').map((item) => item.textContent)).not.toContain('');
    });
  });

  it('shows the folder path it is given with chevron separators', () => {
    render(<RecordingRuleRow hit={baseHit()} fullRule={LOADING} folderPath={FOLDER_PATH} />);
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Team Alerts')).toBeInTheDocument();
  });

  it('omits the folder path when none is given', () => {
    render(<RecordingRuleRow hit={baseHit()} fullRule={LOADING} />);
    expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
  });

  it('orders metadata as folder path, data sources, labels', () => {
    render(
      <RecordingRuleRow
        hit={baseHit({ dataSourceUids: ['loki-1'], labels: { team: 'infra', env: 'prod' } })}
        fullRule={LOADING}
        folderPath={FOLDER_PATH}
      />
    );

    const folder = screen.getByText('Team Alerts');
    const dataSource = screen.getByRole('link', { name: 'Loki prod' });
    const labels = screen.getByText('2 labels');
    expect(folder.compareDocumentPosition(dataSource) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dataSource.compareDocumentPosition(labels) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits the plugin origin label from the label count', async () => {
    render(
      <RecordingRuleRow
        hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'plugin/counted-app' } })}
        fullRule={LOADING}
      />
    );

    expect(screen.getByText('1 label')).toBeInTheDocument();
    expect(await screen.findByText('counted-app')).toBeInTheDocument();
  });

  it('counts an origin label that does not mark a plugin rule as an ordinary label', () => {
    render(
      <RecordingRuleRow hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'my-app' } })} fullRule={LOADING} />
    );

    expect(screen.getByText('2 labels')).toBeInTheDocument();
  });

  it('shows the provisioning badge once the full rule reports provenance', () => {
    render(<RecordingRuleRow hit={baseHit()} fullRule={loadedRule({ 'grafana.com/provenance': 'api' })} />);
    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it('ACT-7: shows the provisioning badge for a managed rule that carries no provenance', () => {
    render(<RecordingRuleRow hit={baseHit()} fullRule={loadedRule({ 'grafana.app/managedBy': 'terraform' })} />);
    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it.each<ManagerCase>([
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
    const { user } = render(<RecordingRuleRow hit={baseHit()} fullRule={loadedRule(annotations)} />);
    await user.hover(screen.getByText('Provisioned'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(new RegExp(`^${tooltip}$`));
  });

  describe('plugin badge', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/plugins/my-app/settings', () =>
          HttpResponse.json({ id: 'my-app', name: 'My App', info: { logos: { small: '/my-app.svg' } } })
        )
      );
    });

    it('ACT-5: shows the badge, resolved by plugin id, for an origin label starting with plugin/', async () => {
      render(<RecordingRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/my-app' } })} fullRule={LOADING} />);

      expect(await screen.findByRole('img', { name: 'My App' })).toBeInTheDocument();
    });

    it('ACT-5: shows no badge for an origin label that does not start with plugin/', () => {
      render(<RecordingRuleRow hit={baseHit({ labels: { __grafana_origin: 'my-app' } })} fullRule={LOADING} />);

      expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'My App' })).not.toBeInTheDocument();
      expect(screen.queryByText('my-app')).not.toBeInTheDocument();
    });

    // Plugin settings are cached per id, so each case needs its own id.
    it('shows the plugin id badge while the plugin settings are loading', async () => {
      server.use(http.get('/api/plugins/slow-app/settings', () => new Promise(() => {})));

      render(
        <RecordingRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/slow-app' } })} fullRule={LOADING} />
      );

      expect(await screen.findByText('slow-app')).toBeInTheDocument();
    });

    it('keeps the plugin id badge when the plugin is not found', async () => {
      server.use(http.get('/api/plugins/missing-app/settings', () => HttpResponse.json({}, { status: 404 })));

      render(
        <RecordingRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/missing-app' } })} fullRule={LOADING} />
      );

      expect(await screen.findByText('missing-app')).toBeInTheDocument();
    });

    it('keeps the plugin id badge when the settings request fails', async () => {
      server.use(http.get('/api/plugins/broken-app/settings', () => HttpResponse.json({}, { status: 500 })));

      render(
        <RecordingRuleRow hit={baseHit({ labels: { __grafana_origin: 'plugin/broken-app' } })} fullRule={LOADING} />
      );

      expect(await screen.findByText('broken-app')).toBeInTheDocument();
    });
  });

  it.each([{ status: 'loading' }, { status: 'error' }] as const)(
    'shows no provisioning badge while the full rule is $status',
    ({ status }) => {
      render(<RecordingRuleRow hit={baseHit({ metric: 'm' })} fullRule={{ status }} />);
      expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
    }
  );

  it('shows no Alert-only information', () => {
    render(<RecordingRuleRow hit={baseHit({ health: 'Recording' })} fullRule={LOADING} />);
    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
    expect(screen.queryByText(/Default policy|Delivered to|Policy:/)).not.toBeInTheDocument();
  });
});
