import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

const server = setupMswServer();

const RECORDING_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/:name';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';

const hit: RecordingRuleSearchHit = {
  uid: 'rule-1',
  title: 'cpu_usage:avg',
  folderUid: 'folder-1',
  labels: {},
  dataSourceUids: [],
};

function mockFullRule(annotations: Record<string, string> = {}) {
  const requests = { count: 0 };
  server.use(
    http.get(RECORDING_RULE_GET_URL, ({ params }) => {
      requests.count += 1;
      return HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: 'RecordingRule',
        metadata: { name: params.name, annotations },
        spec: { title: 'cpu_usage:avg', paused: false },
      });
    })
  );
  return requests;
}

function mockFolderPath() {
  const requests = { count: 0 };
  server.use(
    http.get(FOLDER_PARENTS_URL, () => {
      requests.count += 1;
      return HttpResponse.json({
        items: [
          { name: 'root', title: 'Platform' },
          { name: 'folder-1', title: 'Team Alerts' },
        ],
      });
    })
  );
  return requests;
}

function renderEntry(showFolderPath: boolean) {
  return render(
    <ul>
      <RecordingRuleListEntry hit={hit} showFolderPath={showFolderPath} />
    </ul>
  );
}

describe('RecordingRuleListEntry', () => {
  it('shows the resolved folder path in List mode', async () => {
    mockFullRule();
    mockFolderPath();
    renderEntry(true);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Team Alerts')).toBeInTheDocument();
  });

  it('neither shows nor requests the folder path in Folders mode', async () => {
    mockFullRule({ 'grafana.com/access/canWrite': 'true' });
    const folderRequests = mockFolderPath();
    renderEntry(false);

    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
    expect(folderRequests.count).toBe(0);
  });

  it('feeds one full-rule lookup to both the provisioning badge and the Edit action', async () => {
    const ruleRequests = mockFullRule({ 'grafana.com/provenance': 'api', 'grafana.com/access/canWrite': 'true' });
    renderEntry(false);

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
    // A provisioned rule can't be edited here, so Edit leaves the row once the lookup resolves.
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(ruleRequests.count).toBe(1);
  });

  it('enables Edit once the full rule reports write access', async () => {
    mockFullRule({ 'grafana.com/access/canWrite': 'true' });
    renderEntry(false);

    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/alerting/rule-1/edit');
  });

  it('keeps the row usable, without Edit, when the full-rule lookup fails', async () => {
    server.use(http.get(RECORDING_RULE_GET_URL, () => HttpResponse.json({}, { status: 500 })));
    renderEntry(false);

    expect(await screen.findByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
