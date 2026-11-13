import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, within } from 'test/test-utils';

import { API_GROUP, API_VERSION, type RuleSequence } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import AlertRulesPage from '../alert-rules/AlertRulesPage';
import { alertRuleFactory, recordingRuleFactory, ruleItem } from '../mocks/factories';
import {
  getAlertRuleHandler,
  getRecordingRuleHandler,
  getRuleSequenceHandler,
  getRuleSequenceSearchHandler,
  mockFolderParents,
  mockRuleSearch,
} from '../mocks/handlers';
import RecordingRulesPage from '../recording-rules/RecordingRulesPage';

setupMswServer();

const cpuSequence: RuleSequence = {
  apiVersion: `${API_GROUP}/${API_VERSION}`,
  kind: 'RuleSequence',
  metadata: { name: 'seq-cpu', annotations: { 'grafana.app/folder': 'folder-1' } },
  spec: {
    trigger: { interval: '2m' },
    recordingRules: [{ name: 'cpu-rate' }, { name: 'cpu-avg' }],
    alertingRules: [{ name: 'cpu-high' }, { name: 'cpu-deleted' }],
  },
};

function serveSequenceRules() {
  server.use(
    getRuleSequenceSearchHandler([cpuSequence]),
    getRuleSequenceHandler([cpuSequence]),
    getAlertRuleHandler([
      alertRuleFactory.inFolder('folder-1').build({
        metadata: { name: 'cpu-high' },
        spec: { title: 'CPU high', labels: { team: 'infra', severity: 'page' } },
      }),
    ]),
    getRecordingRuleHandler([
      recordingRuleFactory.inFolder('folder-1').build({
        metadata: { name: 'cpu-rate' },
        spec: { title: 'cpu:rate5m' },
        status: { health: 'Error' },
      }),
      recordingRuleFactory.inFolder('folder-1').build({ metadata: { name: 'cpu-avg' }, spec: { title: 'cpu:avg5m' } }),
    ])
  );
}

async function openSequenceFrom(rowName: string) {
  const row = await screen.findByRole('listitem', { name: rowName });
  await userEvent.click(await within(row).findByRole('button', { name: 'Rule sequence · 2m' }));
  return screen.findByRole('dialog');
}

describe('rule sequence drawer', () => {
  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Alerts' });
  });

  it('lists the recording rules and then the alert rules of the sequence, in evaluation order, under its folder', async () => {
    mockRuleSearch('alert', () => ({ items: [ruleItem('alert', 'cpu-high', 'CPU high', 'folder-1')], metadata: {} }));
    serveSequenceRules();
    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    const drawer = await openSequenceFrom('CPU high');

    expect(within(drawer).getByRole('heading', { name: 'Rule sequence' })).toBeInTheDocument();
    expect(within(drawer).getByText('Evaluated every 2m')).toBeInTheDocument();
    expect(await within(drawer).findByText('Team Alerts')).toBeInTheDocument();
    await within(drawer).findByRole('listitem', { name: 'CPU high' });
    await within(drawer).findByRole('listitem', { name: 'cpu-deleted' });
    const items = within(drawer).getAllByRole('listitem');
    const stepOf = (name: string) => items.indexOf(within(drawer).getByRole('listitem', { name }));
    expect(['cpu:rate5m', 'cpu:avg5m', 'CPU high', 'cpu-deleted'].map(stepOf)).toEqual([0, 1, 2, 3]);
  });

  it('marks the rule it was opened from and shows what is wrong with a failing step', async () => {
    mockRuleSearch('alert', () => ({ items: [ruleItem('alert', 'cpu-high', 'CPU high', 'folder-1')], metadata: {} }));
    serveSequenceRules();
    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    const drawer = await openSequenceFrom('CPU high');

    const cpuHigh = await within(drawer).findByRole('listitem', { name: 'CPU high' });
    expect(cpuHigh).toHaveAttribute('aria-current', 'true');
    expect(within(drawer).getByRole('listitem', { name: 'cpu:rate5m' })).not.toHaveAttribute('aria-current');
    expect(within(cpuHigh).getByText('This rule')).toBeInTheDocument();
    expect(within(cpuHigh).getByText('2 labels')).toBeInTheDocument();
    const cpuRate = within(drawer).getByRole('listitem', { name: 'cpu:rate5m' });
    expect(within(cpuRate).getByText('Failed to evaluate rule')).toBeInTheDocument();
    expect(within(drawer).queryByText(/Rule sequence ·/)).not.toBeInTheDocument();
  });

  it('shows a placeholder for a member rule that cannot be loaded', async () => {
    mockRuleSearch('alert', () => ({ items: [ruleItem('alert', 'cpu-high', 'CPU high', 'folder-1')], metadata: {} }));
    serveSequenceRules();
    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    const drawer = await openSequenceFrom('CPU high');

    const deleted = await within(drawer).findByRole('listitem', { name: 'cpu-deleted' });
    expect(within(deleted).getByText('Rule not found or not accessible')).toBeInTheDocument();
  });

  it('opens from the recording rules list and highlights the recording rule', async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'cpu-avg', 'cpu:avg5m', 'folder-1')],
      metadata: {},
    }));
    serveSequenceRules();
    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    const drawer = await openSequenceFrom('cpu:avg5m');

    expect(await within(drawer).findByRole('listitem', { name: 'cpu:avg5m' })).toHaveAttribute('aria-current', 'true');
    expect(await within(drawer).findByRole('listitem', { name: 'CPU high' })).not.toHaveAttribute('aria-current');
  });

  it('shows an error in the drawer when the sequence cannot be loaded', async () => {
    mockRuleSearch('alert', () => ({ items: [ruleItem('alert', 'cpu-high', 'CPU high', 'folder-1')], metadata: {} }));
    serveSequenceRules();
    server.use(
      http.get(`/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/rulesequences/:name`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    const drawer = await openSequenceFrom('CPU high');

    expect(await within(drawer).findByText('Failed to load the rule sequence')).toBeInTheDocument();
  });
});
