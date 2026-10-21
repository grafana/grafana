import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { folderItem } from '../mocks/factories';
import {
  FOLDER_COUNTS_URL,
  FOLDER_PARENTS_URL,
  FOLDER_SEARCH_URL,
  mockFolderCounts,
  mockFolderParents,
  mockFolderSearch,
} from '../mocks/handlers';

import { AlertRulesFoldersView } from './AlertRulesFoldersView';

const server = setupMswServer();

describe('AlertRulesFoldersView folder row lookups', () => {
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
          : HttpResponse.json({ counts: [{ resource: 'alertrules', group: 'rules.alerting.grafana.app', count: 4 }] });
      })
    );

    const { user } = render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('Count unavailable')).toBeInTheDocument();
    // The failed lookup affects only the count: the folder row itself stays usable.
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Retry loading the rule count of Team Alerts' }));

    expect(await screen.findByText('4 alert rules')).toBeInTheDocument();
    expect(screen.queryByText('Count unavailable')).not.toBeInTheDocument();
  });

  it('shows zero rules when /counts succeeds without an entry for this rule kind', async () => {
    server.use(http.get(FOLDER_COUNTS_URL, () => HttpResponse.json({ counts: [] })));

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('0 alert rules')).toBeInTheDocument();
  });

  it('keeps the title and count and shows no parent path when /parents fails', async () => {
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    mockFolderCounts('alert', { 'folder-1': 2 });

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('2 alert rules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();
  });

  it.each([
    { name: 'a folder filter returns no folders', folderUids: ['folder-1'], text: 'No alert rules match this folder' },
    { name: 'no folder filter is active', folderUids: [], text: 'No folders found' },
  ])('says "$text" when $name', async ({ folderUids, text }) => {
    server.use(http.post(FOLDER_SEARCH_URL, () => HttpResponse.json({ items: [], metadata: {} })));

    render(<AlertRulesFoldersView folderUids={folderUids} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});
