import { HttpResponse, delay, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { type UseFolderReadmeResult, useFolderReadme } from '../../hooks/useFolderReadme';
import { setupProvisioningMswServer } from '../../mocks/server';

import { FOLDER_README_ANCHOR_ID, FolderReadmePanel } from './FolderReadmePanel';
import { FolderReadmeEvents } from './analytics/main';

jest.mock('../../hooks/useFolderReadme');

setupProvisioningMswServer();

// The resource listing is fetched lazily on link click; stub the endpoint per test.
function setResources(items: ResourceListItem[]) {
  server.use(http.get(`${BASE}/repositories/:name/resources`, () => HttpResponse.json({ items })));
}

const mockUseFolderReadme = useFolderReadme as jest.MockedFunction<typeof useFolderReadme>;
const editClickedSpy = jest.spyOn(FolderReadmeEvents, 'editClicked').mockImplementation();
const createClickedSpy = jest.spyOn(FolderReadmeEvents, 'createClicked').mockImplementation();
const linkClickedSpy = jest.spyOn(FolderReadmeEvents, 'linkClicked').mockImplementation();

const mockRepository = {
  name: 'test-repo',
  target: 'folder' as const,
  title: 'Test Repository',
  type: 'github' as const,
  url: 'https://github.com/owner/repo',
  branch: 'main',
  workflows: [],
};

const mockFolder = {
  metadata: {
    name: 'test-folder',
    annotations: {
      'grafana.app/sourcePath': 'dashboards/team-a',
    },
  },
  spec: { title: 'Test Folder' },
  status: {},
} as never;

function setReadmeResult(overrides: Partial<UseFolderReadmeResult> = {}) {
  mockUseFolderReadme.mockReturnValue({
    repository: mockRepository,
    folder: mockFolder,
    readmePath: 'dashboards/team-a/README.md',
    status: 'ok',
    isLoading: false,
    markdownContent: '# Hello\n\nThis is a README.',
    refetch: jest.fn(),
    syncFinished: undefined,
    ...overrides,
  });
}

function setup(folderUID = 'test-folder') {
  return render(<FolderReadmePanel folderUID={folderUID} />);
}

describe('FolderReadmePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestFlags({ 'provisioning.readmes': true });
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('renders the README markdown inside a panel with an anchor id', () => {
    setReadmeResult();

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);

    const panel = container.querySelector(`#${FOLDER_README_ANCHOR_ID}`);
    expect(panel).not.toBeNull();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('This is a README.')).toBeInTheDocument();
  });

  it('shows an Edit README icon button targeting the host editor when a README exists', () => {
    setReadmeResult();

    render(<FolderReadmePanel folderUID="test-folder" />);

    const editLink = screen.getByRole('link', { name: /Edit README/i });
    expect(editLink).toHaveAttribute('href', 'https://github.com/owner/repo/edit/main/dashboards/team-a/README.md');
  });

  it('prefixes the edit URL with repository.path when configured', () => {
    setReadmeResult({ repository: { ...mockRepository, path: 'ops/resources' } });

    render(<FolderReadmePanel folderUID="test-folder" />);

    expect(screen.getByRole('link', { name: /Edit README/i })).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/edit/main/ops/resources/dashboards/team-a/README.md'
    );
  });

  it('reports an interaction when the edit link is clicked', async () => {
    setReadmeResult();

    const { user } = setup();
    await user.click(screen.getByRole('link', { name: /Edit README/i }));

    expect(editClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github' });
  });

  describe('resource links', () => {
    const dashboardItem: ResourceListItem = {
      path: 'dashboards/team-a/cpu.json',
      resource: 'dashboards',
      name: 'abc',
      group: '',
      hash: '',
    };

    it('navigates in-app when a JSON link maps to a synced dashboard', async () => {
      setResources([dashboardItem]);
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)' });

      const { user } = setup();
      // Spy after render: test-utils swaps the locationService the component uses.
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await user.click(screen.getByRole('link', { name: 'CPU' }));

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
      expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'in_app' });
    });

    it('resolves a bare relative link (no ./) that renderMarkdown would otherwise strip', async () => {
      setResources([dashboardItem]);
      setReadmeResult({ markdownContent: 'See [CPU](cpu.json)' });

      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      const link = screen.getByRole('link', { name: 'CPU' });
      // The href must survive rendering (not be emptied to the app root).
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/blob/main/dashboards/team-a/cpu.json');
      await user.click(link);

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
    });

    it('navigates the current tab to the host URL when a JSON link has no synced resource', async () => {
      setResources([]);
      const assignMock = jest.fn();
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)' });

      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      // window.location.assign is read-only in jsdom; replace it after render.
      const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', { configurable: true, value: { assign: assignMock } });
      try {
        await user.click(screen.getByRole('link', { name: 'CPU' }));

        await waitFor(() =>
          expect(assignMock).toHaveBeenCalledWith('https://github.com/owner/repo/blob/main/dashboards/team-a/cpu.json')
        );
        expect(pushSpy).not.toHaveBeenCalled();
        expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'host' });
      } finally {
        if (originalLocation) {
          Object.defineProperty(window, 'location', originalLocation);
        }
      }
    });

    it('resolves against the current repository after switching repos (no stale listing)', async () => {
      // Same path in each repo maps to a different dashboard. repo-b is delayed so
      // that, without a remount, a stale synchronous read of repo-a's listing would
      // push /d/aaa immediately (before repo-b's refetch resolves).
      server.use(
        http.get(`${BASE}/repositories/:name/resources`, async ({ params }) => {
          const isB = params.name === 'repo-b';
          if (isB) {
            await delay(50);
          }
          return HttpResponse.json({
            items: [
              {
                path: 'dashboards/team-a/cpu.json',
                resource: 'dashboards',
                name: isB ? 'bbb' : 'aaa',
                group: '',
                hash: '',
              },
            ],
          });
        })
      );

      setReadmeResult({ repository: { ...mockRepository, name: 'repo-a' }, markdownContent: 'See [CPU](./cpu.json)' });
      const { user, rerender } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();

      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/aaa'));

      // Switch to a different repository; the component must not reuse repo-a's listing.
      setReadmeResult({ repository: { ...mockRepository, name: 'repo-b' }, markdownContent: 'See [CPU](./cpu.json)' });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      pushSpy.mockClear();

      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/bbb'));
      // Must never have resolved against repo-a's stale listing.
      expect(pushSpy).not.toHaveBeenCalledWith('/d/aaa');
    });

    it('records a host outcome for a non-resource link (markdown doc) and never pushes', async () => {
      setReadmeResult({ markdownContent: 'See [notes](./notes.md)' });

      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      const link = screen.getByRole('link', { name: 'notes' });
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/blob/main/dashboards/team-a/notes.md');
      await user.click(link);

      expect(pushSpy).not.toHaveBeenCalled();
      expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'host' });
    });
  });

  describe('Add README empty state (status: missing)', () => {
    it('renders the Add README button when no README exists', () => {
      setReadmeResult({ status: 'missing', markdownContent: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);

      const addLink = screen.getByRole('link', { name: /Add README/i });
      const href = addLink.getAttribute('href') ?? '';
      expect(href).toMatch(/^https:\/\/github\.com\/owner\/repo\/new\/main\?filename=dashboards%2Fteam-a%2FREADME\.md/);
      const value = decodeURIComponent(new URL(href).searchParams.get('value') ?? '');
      expect(value).toContain('# Test Folder');
    });

    it('reports an interaction when the Add README button is clicked', async () => {
      setReadmeResult({ status: 'missing', markdownContent: undefined });

      const { user } = setup();
      await user.click(screen.getByRole('link', { name: /Add README/i }));

      expect(createClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github' });
    });

    it('hides the Edit icon when no README exists', () => {
      setReadmeResult({ status: 'missing', markdownContent: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);
      expect(screen.queryByRole('link', { name: /Edit README/i })).not.toBeInTheDocument();
    });
  });

  describe('error state (status: error)', () => {
    it('renders a warning alert with a retry button', () => {
      setReadmeResult({ status: 'error', markdownContent: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);

      expect(screen.getByText(/Couldn.t load README/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
    });

    it('calls refetch when the retry button is clicked', async () => {
      const refetch = jest.fn();
      setReadmeResult({ status: 'error', markdownContent: undefined, refetch });

      const { user } = setup();
      await user.click(screen.getByRole('button', { name: /Try again/i }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('hides the Edit pencil in error state', () => {
      setReadmeResult({ status: 'error', markdownContent: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);
      expect(screen.queryByRole('link', { name: /Edit README/i })).not.toBeInTheDocument();
    });

    it('does not show the Add README CTA in error state', () => {
      setReadmeResult({ status: 'error', markdownContent: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);
      expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
    });
  });

  it('renders nothing when the feature toggle is off', () => {
    setTestFlags({ 'provisioning.readmes': false });
    setReadmeResult();

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not invoke useFolderReadme when the feature toggle is off', () => {
    setTestFlags({ 'provisioning.readmes': false });
    setReadmeResult();
    render(<FolderReadmePanel folderUID="test-folder" />);
    expect(mockUseFolderReadme).not.toHaveBeenCalled();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setReadmeResult({ repository: undefined });

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading indicator while the repository view is loading', () => {
    setReadmeResult({ status: 'loading', isLoading: true, repository: undefined });

    render(<FolderReadmePanel folderUID="test-folder" />);
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('shows a loading indicator while the README file is loading', () => {
    setReadmeResult({ status: 'loading', isLoading: true, markdownContent: undefined });

    render(<FolderReadmePanel folderUID="test-folder" />);
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });

  it('renders an empty README without the parse-error message', () => {
    setReadmeResult({ markdownContent: '' });

    render(<FolderReadmePanel folderUID="test-folder" />);
    expect(screen.queryByText(/Unable to display README content/i)).not.toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit README/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
  });

  it('strips script and event-handler payloads even though markdown is rendered without its own sanitizer', () => {
    // renderMarkdown runs with noSanitize:true; textUtil.sanitize is the XSS
    // boundary. This locks that in so noSanitize can't be dropped unnoticed.
    setReadmeResult({
      markdownContent: '<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n[click](javascript:alert(3))',
    });

    const { container } = setup();
    const markdownDiv = container.querySelector('.markdown-html');
    expect(markdownDiv).not.toBeNull();
    expect(markdownDiv!.querySelector('script')).toBeNull();
    expect(markdownDiv!.innerHTML).not.toContain('onerror');
    expect(markdownDiv!.innerHTML).not.toContain('alert(1)');
    expect(markdownDiv!.innerHTML).not.toContain('javascript:');
  });

  it('sanitizes mXSS payloads in README markdown', () => {
    setReadmeResult({
      markdownContent: '<div><svg><style><img src=x onerror=alert(1)></style></svg></div>',
    });

    const { container } = setup();
    const markdownDiv = container.querySelector('.markdown-html');
    expect(markdownDiv).not.toBeNull();
    // DOMPurify strips the dangerous elements
    expect(markdownDiv!.querySelector('img[onerror]')).toBeNull();
    expect(markdownDiv!.innerHTML).not.toContain('onerror');
  });
});
