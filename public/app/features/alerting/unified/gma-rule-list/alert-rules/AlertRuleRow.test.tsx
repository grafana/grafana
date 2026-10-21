import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { FAILED_RULE, LOADING_RULE, buildAlertRule, loadedRule } from '../mocks/factories';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

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

function precedes(a: Node, b: Node) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('AlertRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    render(
      <ul>
        <AlertRuleRow hit={baseHit()} fullRule={LOADING_RULE} />
      </ul>
    );

    expect(screen.getByRole('link', { name: 'CPU high' })).toHaveAttribute('href', '/alerting/grafana/rule-1/view');
    expect(screen.getByRole('listitem', { name: 'CPU high' })).toBeInTheDocument();
  });

  it('shows the status icon of the search hit', () => {
    render(<AlertRuleRow hit={baseHit({ state: 'Firing', health: 'OK' })} fullRule={LOADING_RULE} />);

    expect(screen.getByLabelText('Firing')).toBeInTheDocument();
  });

  it('shows the interval ahead of the actions', () => {
    render(<AlertRuleRow hit={baseHit({ interval: '5m' })} fullRule={LOADING_RULE} actions={<button>Edit</button>} />);

    expect(precedes(screen.getByText('5m'), screen.getByRole('button', { name: 'Edit' }))).toBe(true);
  });

  it.each([
    { name: 'is given', folderPath: FOLDER_PATH, shown: true },
    { name: 'is not given (Folders mode)', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING_RULE} folderPath={folderPath} />);

    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts') !== null).toBe(shown);
  });

  it('shows the last error in place of the summary when both are present', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ lastError: 'connection refused', summary: 'CPU too high' })}
        fullRule={LOADING_RULE}
      />
    );

    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.queryByText('CPU too high')).not.toBeInTheDocument();
  });

  it('shows the summary when there is no last error', () => {
    render(<AlertRuleRow hit={baseHit({ summary: 'CPU too high' })} fullRule={LOADING_RULE} />);

    expect(screen.getByText('CPU too high')).toBeInTheDocument();
  });

  it('orders metadata as folder path, data source, instance totals, labels, routing', () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));
    render(
      <AlertRuleRow
        hit={baseHit({ dataSourceUids: ['prom-1'], labels: { team: 'infra' }, totals: { firing: 2 } })}
        fullRule={LOADING_RULE}
        folderPath={FOLDER_PATH}
      />
    );

    const items = screen.getAllByTestId('rule-meta-item');
    expect(items.map((item) => item.textContent)).toEqual([
      'Team Alerts',
      'Prometheus prod',
      '2 firing',
      '1 label',
      'Default policy',
    ]);
  });

  it('shows only routing as metadata when nothing else is known', () => {
    render(<AlertRuleRow hit={baseHit()} fullRule={LOADING_RULE} />);

    expect(screen.getAllByTestId('rule-meta-item').map((item) => item.textContent)).toEqual(['Default policy']);
  });

  it('keeps routing visible on a paused rule', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ paused: true, notificationType: 'NamedRoutingTree', routingTree: 'escalation-policy' })}
        fullRule={LOADING_RULE}
      />
    );

    expect(screen.getByText('Policy: escalation-policy')).toBeInTheDocument();
  });

  it('shows the direct receiver as a link to its contact point for simplified routing', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ notificationType: 'SimplifiedRouting', receiver: 'on-call-team' })}
        fullRule={LOADING_RULE}
      />
    );

    expect(screen.getByText('Delivered to')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'on-call-team' })).toHaveAttribute(
      'href',
      '/alerting/notifications?search=on-call-team&tab=contact_points&alertmanager=grafana'
    );
  });

  it('shows the plugin badge instead of the provisioning badge for a provisioned plugin rule', async () => {
    render(
      <AlertRuleRow
        hit={baseHit({ labels: { __grafana_origin: 'plugin/counted-app' } })}
        fullRule={loadedRule(buildAlertRule({ annotations: { 'grafana.com/provenance': 'api' } }))}
      />
    );

    expect(await screen.findByText('counted-app')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows no plugin badge for an origin label that does not start with plugin/', () => {
    render(<AlertRuleRow hit={baseHit({ labels: { __grafana_origin: 'my-app' } })} fullRule={LOADING_RULE} />);

    expect(screen.getByText('1 label')).toBeInTheDocument();
    expect(screen.queryByText('my-app')).not.toBeInTheDocument();
  });

  it.each<{ name: string; annotations: Record<string, string> }>([
    { name: 'a provenance annotation', annotations: { 'grafana.com/provenance': 'api' } },
    { name: 'a manager and no provenance', annotations: { 'grafana.app/managedBy': 'terraform' } },
  ])('shows the provisioning badge once the full rule reports $name', ({ annotations }) => {
    render(<AlertRuleRow hit={baseHit()} fullRule={loadedRule(buildAlertRule({ annotations }))} />);

    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it.each([
    { name: 'loading', fullRule: LOADING_RULE },
    { name: 'failed', fullRule: FAILED_RULE },
  ])('shows no provisioning badge while the full rule is $name', ({ fullRule }) => {
    render(<AlertRuleRow hit={baseHit()} fullRule={fullRule} />);

    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
