import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import server from '@grafana/test-utils/server';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { folderItem } from '../mocks/factories';
import {
  FOLDER_COUNTS_URL,
  FOLDER_PARENTS_URL,
  mockFolderCounts,
  mockFolderParents,
  mockFolderSearch,
} from '../mocks/handlers';

import { FoldersView } from './RecordingRulesFoldersView';

setupMswServer();

describe('RecordingRulesFoldersView folder row lookups', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    mockFolderParents({ 'folder-1': 'Team Alerts' });
  });

  it('replaces the count skeleton with an unavailable message and Retry when /counts fails, then shows the count after Retry', async () => {
    let attempts = 0;
    server.use(
      http.get(FOLDER_COUNTS_URL, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({
              counts: [{ resource: 'recordingrules', group: 'rules.alerting.grafana.app', count: 4 }],
            });
      })
    );

    const { user } = render(<FoldersView folderUids={[]} />);

    expect(await screen.findByText('Count unavailable')).toBeInTheDocument();
    // The failed lookup affects only the count: the folder row itself stays usable.
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Retry loading the rule count of Team Alerts' }));

    expect(await screen.findByText('4 recording rules')).toBeInTheDocument();
    expect(screen.queryByText('Count unavailable')).not.toBeInTheDocument();
  });

  it('shows zero rules when /counts succeeds without an entry for this rule kind', async () => {
    server.use(http.get(FOLDER_COUNTS_URL, () => HttpResponse.json({ counts: [] })));

    render(<FoldersView folderUids={[]} />);

    expect(await screen.findByText('0 recording rules')).toBeInTheDocument();
  });

  it('keeps the title and count and shows no parent path when /parents fails', async () => {
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    mockFolderCounts('recording', { 'folder-1': 2 });

    render(<FoldersView folderUids={[]} />);

    expect(await screen.findByText('2 recording rules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();
  });

  it.each([
    {
      name: 'a folder filter returns no folders',
      folderUids: ['folder-1'],
      text: 'No recording rules match this folder',
    },
    { name: 'no folder filter is active', folderUids: [], text: 'No folders found' },
  ])('shows "$text" when $name and there are no folders', async ({ folderUids, text }) => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    render(<FoldersView folderUids={folderUids} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});
