import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { folderItem } from '../mocks/factories';
import {
  FOLDER_COUNTS_URL,
  FOLDER_PARENTS_URL,
  FOLDER_SEARCH_URL,
  failFirstCall,
  mockFolderCounts,
  mockFolderParents,
  mockFolderSearch,
} from '../mocks/handlers';

import { AlertRulesFoldersView } from './AlertRulesFoldersView';

const server = setupMswServer();

describe('AlertRulesFoldersView', () => {
  beforeEach(() => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    mockFolderParents({ 'folder-1': 'Team Alerts' });
  });

  it('shows an unavailable message in place of the count when /counts fails, while the folder row stays usable', async () => {
    server.use(http.get(FOLDER_COUNTS_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('Count unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('shows zero rules when /counts succeeds without an entry for this rule kind', async () => {
    server.use(http.get(FOLDER_COUNTS_URL, () => HttpResponse.json({ counts: [] })));

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('0 alert rules')).toBeInTheDocument();
  });

  it('shows the parents from /parents beside the title, without repeating the folder itself', async () => {
    mockFolderParents({ 'folder-1': ['Platform', 'Team Alerts'] });
    mockFolderCounts('alert', { 'folder-1': 2 });

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getAllByText('Team Alerts')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
  });

  it('keeps the title and count and shows no parent when /parents fails', async () => {
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    mockFolderCounts('alert', { 'folder-1': 2 });

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('2 alert rules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();
    expect(screen.queryByText('Platform')).not.toBeInTheDocument();
  });

  it.each([
    { name: 'a folder filter returns no folders', folderUids: ['folder-1'], text: 'No alert rules match this folder' },
    { name: 'no folder filter is active', folderUids: [], text: 'No alert rules found' },
  ])('says "$text" when $name', async ({ folderUids, text }) => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    render(<AlertRulesFoldersView folderUids={folderUids} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it.each([
    {
      name: 'a 500 response',
      mockFirstCallFailure: () =>
        failFirstCall('post', FOLDER_SEARCH_URL, { items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }),
    },
    {
      name: 'a response that does not match the schema',
      mockFirstCallFailure: () =>
        mockFolderSearch((_, call) => ({
          items: call === 1 ? [{ fields: {} }] : [folderItem('folder-1', 'Team Alerts')],
          metadata: {},
        })),
    },
  ])(
    'shows the folder search error with Retry for $name, and the folder after Retry',
    async ({ mockFirstCallFailure }) => {
      mockFirstCallFailure();
      mockFolderCounts('alert', { 'folder-1': 1 });

      const { user } = render(<AlertRulesFoldersView folderUids={[]} />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load folders');

      await user.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    }
  );

  it('names a folder by its UID when the search returns no title', async () => {
    mockFolderSearch(() => ({ items: [{ resource: { name: 'folder-1' }, fields: { title: 7 } }], metadata: {} }));
    mockFolderCounts('alert', { 'folder-1': 1 });

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByRole('link', { name: 'folder-1' })).toBeInTheDocument();
  });
});
