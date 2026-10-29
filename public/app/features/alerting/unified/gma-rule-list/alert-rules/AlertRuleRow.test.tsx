import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { FAILED_RULE, LOADING_RULE, buildAlertRule, loadedRule } from '../mocks/factories';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1', ...overrides };
}

function renderRow(
  props: Omit<Parameters<typeof AlertRuleRow>[0], 'fullRule'> & Partial<Parameters<typeof AlertRuleRow>[0]>
) {
  return render(
    <ul>
      <AlertRuleRow fullRule={LOADING_RULE} {...props} />
    </ul>
  );
}

describe('AlertRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByRole('link', { name: 'CPU high' })).toHaveAttribute('href', '/alerting/grafana/rule-1/view');
    expect(screen.getByRole('listitem', { name: 'CPU high' })).toBeInTheDocument();
  });

  it('shows the status icon of the search hit', () => {
    renderRow({ searchHit: baseHit({ state: 'Firing', health: 'OK' }) });

    expect(screen.getByLabelText('Firing')).toBeInTheDocument();
  });

  it('reads Status unavailable, never healthy, when the hit carries no status', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Alerts'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ searchHit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts') !== null).toBe(shown);
  });

  it('shows the last error when the hit has one', () => {
    renderRow({ searchHit: baseHit({ lastError: 'remote write failed' }) });

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
  });

  it('shows the summary annotation when there is no error', () => {
    renderRow({ searchHit: baseHit({ summary: 'CPU usage is high' }) });

    expect(screen.getByText('CPU usage is high')).toBeInTheDocument();
  });

  it('shows no description when neither error nor summary is present', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText('remote write failed')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU usage is high')).not.toBeInTheDocument();
  });

  it('shows the evaluation interval', () => {
    renderRow({ searchHit: baseHit({ interval: '5m' }) });

    expect(screen.getByRole('img', { name: 'Evaluated every 5m' })).toBeInTheDocument();
  });

  it('shows no interval indicator when interval is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
  });

  it('shows queried datasources when the hit has them', () => {
    setupDataSources(mockDataSource({ uid: 'ds-prom', name: 'Prometheus' }));
    renderRow({ searchHit: baseHit({ datasourceUIDs: ['ds-prom'] }) });

    expect(screen.getByRole('link', { name: 'Prometheus' })).toBeInTheDocument();
  });

  it('shows no datasources when the hit has none', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByRole('link', { name: /data source/i })).not.toBeInTheDocument();
  });

  it('shows labels when the hit has them', () => {
    renderRow({ searchHit: baseHit({ labels: { team: 'platform', env: 'prod' } }) });

    expect(screen.getByText('2 labels')).toBeInTheDocument();
  });

  it('shows no labels when the hit has none', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText(/label/)).not.toBeInTheDocument();
  });

  it('shows the instance totals the hit carries, and none when it carries none', () => {
    const { unmount } = renderRow({ searchHit: baseHit({ totals: { firing: 2, healthy: 5 } }) });

    expect(screen.getByText('5 healthy, 2 firing')).toBeInTheDocument();
    unmount();

    renderRow({ searchHit: baseHit() });
    expect(screen.queryByText(/firing|healthy/)).not.toBeInTheDocument();
  });

  it('shows Default policy as routing when the hit names no contact point or policy', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByText('Default policy')).toBeInTheDocument();
  });

  it('shows the named policy for a rule routed through a named routing tree', () => {
    renderRow({ searchHit: baseHit({ notificationType: 'NamedRoutingTree', routingTree: 'escalation-policy' }) });

    expect(screen.getByText('Policy: escalation-policy')).toBeInTheDocument();
  });

  it('shows the direct receiver as a link to its contact point for simplified routing', () => {
    renderRow({ searchHit: baseHit({ notificationType: 'SimplifiedRouting', receiver: 'on-call-team' }) });

    expect(screen.getByText('Delivered to')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'on-call-team' })).toHaveAttribute(
      'href',
      '/alerting/notifications?search=on-call-team&tab=contact_points&alertmanager=grafana'
    );
  });

  it('shows the plugin badge instead of the provisioning badge for a provisioned plugin rule', async () => {
    renderRow({
      searchHit: baseHit({ originLabel: 'plugin/counted-app' }),
      fullRule: loadedRule(buildAlertRule({ annotations: { 'grafana.com/provenance': 'api' } })),
    });

    expect(await screen.findByText('counted-app')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows no plugin badge for an origin label that does not start with plugin/', () => {
    renderRow({ searchHit: baseHit({ originLabel: 'my-app' }) });

    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByText('my-app')).not.toBeInTheDocument();
  });

  it.each<{ name: string; annotations: Record<string, string> }>([
    { name: 'a provenance annotation', annotations: { 'grafana.com/provenance': 'api' } },
    { name: 'a manager and no provenance', annotations: { 'grafana.app/managedBy': 'terraform' } },
  ])('shows the provisioning badge once the full rule reports $name', ({ annotations }) => {
    renderRow({ searchHit: baseHit(), fullRule: loadedRule(buildAlertRule({ annotations })) });

    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it.each([
    { name: 'loading', fullRule: LOADING_RULE },
    { name: 'failed', fullRule: FAILED_RULE },
  ])('shows no provisioning badge while the full rule is $name', ({ fullRule }) => {
    renderRow({ searchHit: baseHit(), fullRule });

    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows the actions after the interval', () => {
    renderRow({ searchHit: baseHit({ interval: '5m' }), actions: <button>Edit</button> });

    const interval = screen.getByText('5m');
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(Boolean(interval.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});
