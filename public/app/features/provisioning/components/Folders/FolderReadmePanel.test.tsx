import { HttpResponse, delay, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { provisioningAPIv0alpha1, type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { type UseFolderDocsResult, useFolderDocs } from '../../hooks/useFolderDocs';
import { type UseFolderReadmeResult, useFolderReadme } from '../../hooks/useFolderReadme';
import { setupProvisioningMswServer } from '../../mocks/server';
import { type FolderDoc, type FolderDocKey } from '../../utils/folderDocConventions';

import { FOLDER_README_ANCHOR_ID, FolderReadmePanel } from './FolderReadmePanel';
import { FolderReadmeEvents } from './analytics/main';

jest.mock('../../hooks/useFolderDocs');
jest.mock('../../hooks/useFolderReadme');

setupProvisioningMswServer();

// The resource listing is fetched lazily on link click; stub the endpoint per test.
function setResources(items: ResourceListItem[]) {
  server.use(http.get(`${BASE}/repositories/:name/resources`, () => HttpResponse.json({ items })));
}

const mockUseFolderDocs = useFolderDocs as jest.MockedFunction<typeof useFolderDocs>;
const mockUseFolderReadme = useFolderReadme as jest.MockedFunction<typeof useFolderReadme>;
const editClickedSpy = jest.spyOn(FolderReadmeEvents, 'editClicked').mockImplementation();
const createClickedSpy = jest.spyOn(FolderReadmeEvents, 'createClicked').mockImplementation();
const linkClickedSpy = jest.spyOn(FolderReadmeEvents, 'linkClicked').mockImplementation();
const tabSelectedSpy = jest.spyOn(FolderReadmeEvents, 'tabSelected').mockImplementation();

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

function doc(key: FolderDocKey | undefined, fileName: string): FolderDoc {
  return { key, path: `dashboards/team-a/${fileName}`, fileName };
}

const readmeDoc = doc('readme', 'README.md');

function setDocs(overrides: Partial<UseFolderDocsResult> = {}) {
  mockUseFolderDocs.mockReturnValue({
    repository: mockRepository,
    folder: mockFolder,
    sourceDir: 'dashboards/team-a',
    docs: [readmeDoc],
    isLoading: false,
    ...overrides,
  });
}

function setReadmeResult(overrides: Partial<UseFolderReadmeResult> = {}) {
  mockUseFolderReadme.mockReturnValue({
    repository: mockRepository,
    folder: mockFolder,
    readmePath: 'dashboards/team-a/README.md',
    status: 'ok',
    isLoading: false,
    isFetching: false,
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
    // Stub prefetch so the panel doesn't fire real queries during unit tests.
    jest.spyOn(provisioningAPIv0alpha1, 'usePrefetch').mockReturnValue(jest.fn());
    setDocs();
    setReadmeResult();
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('renders the README markdown inside a panel with an anchor id and a README tab', () => {
    const { container } = setup();

    const panel = container.querySelector(`#${FOLDER_README_ANCHOR_ID}`);
    expect(panel).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('This is a README.')).toBeInTheDocument();
  });

  it('shows an Edit icon button targeting the host editor when a doc exists', () => {
    setup();

    const editLink = screen.getByRole('link', { name: /Edit document/i });
    expect(editLink).toHaveAttribute('href', 'https://github.com/owner/repo/edit/main/dashboards/team-a/README.md');
  });

  it('prefixes the edit URL with repository.path when configured', () => {
    setDocs({ repository: { ...mockRepository, path: 'ops/resources' } });
    setup();

    expect(screen.getByRole('link', { name: /Edit document/i })).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/edit/main/ops/resources/dashboards/team-a/README.md'
    );
  });

  it('reports an interaction when the edit link is clicked', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: /Edit document/i }));

    expect(editClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github' });
  });

  describe('documentation tabs', () => {
    it('renders a tab per recognized convention doc, GitHub-style', () => {
      setDocs({
        docs: [readmeDoc, doc('contributing', 'CONTRIBUTING.md'), doc('security', 'SECURITY.md')],
      });
      setup();

      expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Contributing' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument();
    });

    it('renders other markdown files as tabs labeled by file name (no extension)', () => {
      setDocs({
        docs: [readmeDoc, doc(undefined, 'CHANGELOG.md')],
      });
      setup();

      expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'CHANGELOG' })).toBeInTheDocument();
    });

    it('switches the active doc and reports an interaction when a tab is clicked', async () => {
      const contributing = doc('contributing', 'CONTRIBUTING.md');
      setDocs({ docs: [readmeDoc, contributing] });
      const { user } = setup();

      await user.click(screen.getByRole('tab', { name: 'Contributing' }));

      expect(mockUseFolderReadme).toHaveBeenLastCalledWith('test-folder', contributing.path);
      expect(tabSelectedSpy).toHaveBeenCalledWith({ repositoryType: 'github', doc: 'contributing' });
    });

    it('persists the active tab in the URL and restores it from the query param', () => {
      const contributing = doc('contributing', 'CONTRIBUTING.md');
      setDocs({ docs: [readmeDoc, contributing] });

      render(<FolderReadmePanel folderUID="test-folder" />, {
        historyOptions: { initialEntries: ['/?docTab=CONTRIBUTING.md'] },
      });

      expect(mockUseFolderReadme).toHaveBeenLastCalledWith('test-folder', contributing.path);
    });

    it('shows a loading overlay while the newly selected doc is fetching', () => {
      setReadmeResult({ status: 'ok', isFetching: true });
      setup();

      expect(screen.getByTestId('folder-doc-loading')).toBeInTheDocument();
    });

    it('reports "other" for a non-convention doc selection', async () => {
      const changelog = doc(undefined, 'CHANGELOG.md');
      setDocs({ docs: [readmeDoc, changelog] });
      const { user } = setup();

      await user.click(screen.getByRole('tab', { name: 'CHANGELOG' }));

      expect(tabSelectedSpy).toHaveBeenCalledWith({ repositoryType: 'github', doc: 'other' });
    });

    it('still shows the other doc tabs (plus a README tab) when the README file is missing', () => {
      // useFolderDocs only discovers files that exist — no README here.
      setDocs({ docs: [doc('security', 'SECURITY.md')] });
      setup();

      expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument();
    });

    it('prefetches the next couple of docs once the active doc has loaded', () => {
      const prefetch = jest.fn();
      jest.spyOn(provisioningAPIv0alpha1, 'usePrefetch').mockReturnValue(prefetch);
      setDocs({
        docs: [
          readmeDoc,
          doc('contributing', 'CONTRIBUTING.md'),
          doc('security', 'SECURITY.md'),
          doc(undefined, 'CHANGELOG.md'),
        ],
      });
      setReadmeResult({ status: 'ok' });
      setup();

      // README is active (index 0), so the next two docs are warmed — not the third.
      expect(prefetch).toHaveBeenCalledWith({ name: 'test-repo', path: 'dashboards/team-a/CONTRIBUTING.md' });
      expect(prefetch).toHaveBeenCalledWith({ name: 'test-repo', path: 'dashboards/team-a/SECURITY.md' });
      expect(prefetch).not.toHaveBeenCalledWith({ name: 'test-repo', path: 'dashboards/team-a/CHANGELOG.md' });
    });
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

    it('resolves when the click lands on a non-HTML element inside the link (e.g. an SVG icon)', async () => {
      setResources([dashboardItem]);
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)' });

      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      const link = screen.getByRole('link', { name: 'CPU' });
      // An inline SVG icon's element is an SVGElement, not an HTMLElement.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      link.appendChild(svg);
      await user.click(svg);

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

      // The panel resolves links against the repository from useFolderDocs.
      setDocs({ repository: { ...mockRepository, name: 'repo-a' } });
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)' });
      const { user, rerender } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();

      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/aaa'));

      // Switch to a different repository; the component must not reuse repo-a's listing.
      setDocs({ repository: { ...mockRepository, name: 'repo-b' } });
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)' });
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

  describe('Add README empty state (no recognized docs)', () => {
    beforeEach(() => {
      setDocs({ docs: [] });
      setReadmeResult({ status: 'missing', markdownContent: undefined });
    });

    it('renders the Add README button when no README exists', () => {
      setup();

      const addLink = screen.getByRole('link', { name: /Add README/i });
      const href = addLink.getAttribute('href') ?? '';
      expect(href).toMatch(/^https:\/\/github\.com\/owner\/repo\/new\/main\?filename=dashboards%2Fteam-a%2FREADME\.md/);
      const value = decodeURIComponent(new URL(href).searchParams.get('value') ?? '');
      expect(value).toContain('# Test Folder');
    });

    it('reports an interaction when the Add README button is clicked', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('link', { name: /Add README/i }));

      expect(createClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github' });
    });

    it('hides the Edit icon when no README exists', () => {
      setup();
      expect(screen.queryByRole('link', { name: /Edit/i })).not.toBeInTheDocument();
    });
  });

  describe('error state (status: error)', () => {
    beforeEach(() => {
      setReadmeResult({ status: 'error', markdownContent: undefined });
    });

    it('renders a warning alert with a retry button', () => {
      setup();

      expect(screen.getByText(/Couldn.t load this document/i)).toBeInTheDocument();
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
      setup();
      expect(screen.queryByRole('link', { name: /Edit/i })).not.toBeInTheDocument();
    });

    it('does not show the Add README CTA in error state', () => {
      setup();
      expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
    });
  });

  it('renders nothing when the feature toggle is off', () => {
    setTestFlags({ 'provisioning.readmes': false });

    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  it('does not invoke the data hooks when the feature toggle is off', () => {
    setTestFlags({ 'provisioning.readmes': false });
    setup();
    expect(mockUseFolderDocs).not.toHaveBeenCalled();
    expect(mockUseFolderReadme).not.toHaveBeenCalled();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setDocs({ repository: undefined, docs: [] });
    setReadmeResult({ repository: undefined });

    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading indicator while discovery is in progress', () => {
    setDocs({ repository: undefined, docs: [], isLoading: true });
    setReadmeResult({ status: 'loading', isLoading: true, repository: undefined });

    setup();
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
  });

  it('shows a loading indicator while the doc content is loading', () => {
    setReadmeResult({ status: 'loading', isLoading: true, markdownContent: undefined });

    setup();
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });

  it('renders an empty README without the parse-error message', () => {
    setReadmeResult({ markdownContent: '' });

    setup();
    expect(screen.queryByText(/Unable to display this document/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit document/i })).toBeInTheDocument();
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
