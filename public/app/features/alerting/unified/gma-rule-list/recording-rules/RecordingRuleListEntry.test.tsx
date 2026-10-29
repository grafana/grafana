import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { FOLDER_PARENTS_URL, mockFullRule, ruleUrl } from '../mocks/handlers';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

setupMswServer();

const searchHit: RecordingRuleSearchHit = {
  uid: 'rule-1',
  title: 'cpu_usage:avg',
  folderUid: 'folder-1',
};

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
      <RecordingRuleListEntry searchHit={searchHit} showFolderPath={showFolderPath} />
    </ul>
  );
}

describe('RecordingRuleListEntry', () => {
  it('shows the resolved folder path in List mode', async () => {
    mockFullRule('recording');
    mockFolderPath();
    renderEntry(true);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Team Alerts')).toBeInTheDocument();
  });

  it('neither shows nor requests the folder path in Folders mode, and enables Edit once the rule reports write access', async () => {
    mockFullRule('recording', { 'grafana.com/access/canWrite': 'true' });
    const folderRequests = mockFolderPath();
    renderEntry(false);

    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/alerting/rule-1/edit');
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
    expect(folderRequests.count).toBe(0);
  });

  it('feeds one full-rule lookup to both the provisioning badge and the Edit action', async () => {
    const ruleRequests = mockFullRule('recording', {
      'grafana.com/provenance': 'api',
      'grafana.com/access/canWrite': 'true',
    });
    renderEntry(false);

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
    // A provisioned rule can't be edited here, so Edit leaves the row once the lookup resolves.
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(ruleRequests.count).toBe(1);
  });

  it('keeps the row usable, without Edit, when the full-rule lookup fails', async () => {
    server.use(http.get(ruleUrl('recording'), () => HttpResponse.json({}, { status: 500 })));
    renderEntry(false);

    expect(await screen.findByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
