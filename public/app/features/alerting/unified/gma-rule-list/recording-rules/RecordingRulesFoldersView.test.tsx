import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';

import { FoldersView } from './RecordingRulesFoldersView';

const server = setupMswServer();

const FOLDER_SEARCH_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/search';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';
const FOLDER_COUNTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/counts';

function mockFolders() {
  server.use(
    http.post(FOLDER_SEARCH_URL, () =>
      HttpResponse.json({
        items: [
          {
            resource: { group: 'folder.grafana.app', kind: 'Folder', name: 'folder-1', resource: 'folders' },
            fields: { title: 'Team Alerts' },
          },
        ],
        metadata: {},
      })
    )
  );
}

function mockParents(handler: Parameters<typeof http.get>[1]) {
  server.use(http.get(FOLDER_PARENTS_URL, handler));
}

describe('RecordingRulesFoldersView folder row lookups', () => {
  const previousPermissions = contextSrv.user.permissions;

  beforeEach(() => {
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    mockFolders();
    mockParents(() => HttpResponse.json({ items: [{ name: 'folder-1', title: 'Team Alerts' }] }));
  });

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
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
    mockParents(() => HttpResponse.json({ message: 'boom' }, { status: 500 }));
    server.use(
      http.get(FOLDER_COUNTS_URL, () =>
        HttpResponse.json({ counts: [{ resource: 'recordingrules', group: 'rules.alerting.grafana.app', count: 2 }] })
      )
    );

    render(<FoldersView folderUids={[]} />);

    expect(await screen.findByText('2 recording rules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();
  });

  it('says no recording rules match the folder when a folder filter returns no folders', async () => {
    server.use(http.post(FOLDER_SEARCH_URL, () => HttpResponse.json({ items: [], metadata: {} })));

    render(<FoldersView folderUids={['folder-1']} />);

    expect(await screen.findByText('No recording rules match this folder')).toBeInTheDocument();
    expect(screen.queryByText('No folders found')).not.toBeInTheDocument();
  });

  it('keeps the plain empty state when no folder filter is active', async () => {
    server.use(http.post(FOLDER_SEARCH_URL, () => HttpResponse.json({ items: [], metadata: {} })));

    render(<FoldersView folderUids={[]} />);

    expect(await screen.findByText('No folders found')).toBeInTheDocument();
  });
});
