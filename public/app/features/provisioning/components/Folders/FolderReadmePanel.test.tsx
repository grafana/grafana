import mermaid from 'mermaid';
import { HttpResponse, delay, http } from 'msw';
import { act, fireEvent, render, screen, waitFor } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type ResourceListItem, provisioningAPIv0alpha1 } from 'app/api/clients/provisioning/v0alpha1';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { getState } from 'app/store/store';

import { type UseFolderDocsResult, useFolderDocs } from '../../hooks/useFolderDocs';
import { type UseFolderReadmeResult, useFolderReadme } from '../../hooks/useFolderReadme';
import { setupProvisioningMswServer } from '../../mocks/server';
import { type FolderDoc, type FolderDocKey } from '../../utils/folderDocConventions';

import { FOLDER_README_ANCHOR_ID, FolderReadmePanel } from './FolderReadmePanel';
import { FolderReadmeEvents } from './analytics/main';

jest.mock('../../hooks/useFolderDocs');
jest.mock('../../hooks/useFolderReadme');

// mermaid is a heavy browser-only library; mock the module so tests can assert the
// rendered diagram wiring without pulling in its full runtime.
jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), parse: jest.fn().mockResolvedValue(true), render: jest.fn() },
}));

setupProvisioningMswServer();

function setResources(items: ResourceListItem[]) {
  const batches = jest.fn();
  const listing = jest.fn();
  server.use(
    http.post(`${BASE}/repositories/:name/resources/resolve`, async ({ request }) => {
      const { paths } = (await request.json()) as { paths: string[] };
      batches(paths);
      return HttpResponse.json({
        results: paths.map((path) => ({ path, resource: items.find((item) => item.path === path) })),
      });
    }),
    http.get(`${BASE}/repositories/:name/resources`, () => {
      listing();
      return HttpResponse.json({ items });
    })
  );
  return { batches, listing };
}

const mockUseFolderDocs = jest.mocked(useFolderDocs);
const mockUseFolderReadme = jest.mocked(useFolderReadme);
const mockMermaidRender = jest.mocked(mermaid.render);
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
    docs: [readmeDoc],
    isLoading: false,
    ...overrides,
  });
}

function setReadmeResult(overrides: Partial<UseFolderReadmeResult> = {}) {
  mockUseFolderReadme.mockReturnValue({
    status: 'ok',
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
    // locationUtil keeps module-level config, so reset it between tests
    locationUtil.initialize({
      config: { appSubUrl: '' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
    setDocs();
    setReadmeResult();
    setResources([]);
    mockMermaidRender.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"></svg>', diagramType: 'flowchart' });
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
    // Tabs are plain <a href> links; route their clicks through the SPA history the
    // way the app does so they change the URL instead of triggering a jsdom navigation.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

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

    it('links each tab to its ?docTab= URL, keeping other query params', () => {
      setDocs({ docs: [readmeDoc, doc('contributing', 'CONTRIBUTING.md')] });
      render(<FolderReadmePanel folderUID="test-folder" />, {
        historyOptions: { initialEntries: ['/dashboards/f/test-folder?query=cpu'] },
      });

      expect(screen.getByRole('tab', { name: 'Contributing' })).toHaveAttribute(
        'href',
        '/dashboards/f/test-folder?query=cpu&docTab=CONTRIBUTING.md'
      );
    });

    it('prefixes tab hrefs with the configured app sub url', () => {
      // Cmd/middle-click and copy-link bypass the router, so the href itself has
      // to be valid under a subpath install.
      locationUtil.initialize({
        config: { appSubUrl: '/grafana' } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
      setDocs({ docs: [readmeDoc, doc('contributing', 'CONTRIBUTING.md')] });
      render(<FolderReadmePanel folderUID="test-folder" />, {
        historyOptions: { initialEntries: ['/dashboards/f/test-folder'] },
      });

      expect(screen.getByRole('tab', { name: 'Contributing' })).toHaveAttribute(
        'href',
        '/grafana/dashboards/f/test-folder?docTab=CONTRIBUTING.md'
      );
    });

    it('switches the active doc via the URL and reports an interaction when a tab is clicked', async () => {
      const contributing = doc('contributing', 'CONTRIBUTING.md');
      setDocs({ docs: [readmeDoc, contributing] });
      const { user } = setup();

      await user.click(screen.getByRole('tab', { name: 'Contributing' }));

      expect(locationService.getSearchObject()).toEqual({ docTab: 'CONTRIBUTING.md' });
      expect(screen.getByRole('tab', { name: 'Contributing' })).toHaveAttribute('aria-selected', 'true');
      expect(mockUseFolderReadme).toHaveBeenLastCalledWith('test-repo', contributing.path);
      expect(tabSelectedSpy).toHaveBeenCalledWith({ repositoryType: 'github', doc: 'contributing' });
    });

    it('persists the active tab in the URL and restores it from the query param', () => {
      const contributing = doc('contributing', 'CONTRIBUTING.md');
      setDocs({ docs: [readmeDoc, contributing] });

      render(<FolderReadmePanel folderUID="test-folder" />, {
        historyOptions: { initialEntries: ['/?docTab=CONTRIBUTING.md'] },
      });

      expect(mockUseFolderReadme).toHaveBeenLastCalledWith('test-repo', contributing.path);
    });

    it('selects the doc when ?docTab= is cased differently to the file', () => {
      // A README links docs by the name the author typed, which may not match the
      // casing of the file in the repo.
      const contributing = doc('contributing', 'contributing.md');
      setDocs({ docs: [readmeDoc, contributing] });

      render(<FolderReadmePanel folderUID="test-folder" />, {
        historyOptions: { initialEntries: ['/?docTab=CONTRIBUTING.md'] },
      });

      expect(screen.getByRole('tab', { name: 'Contributing' })).toHaveAttribute('aria-selected', 'true');
      expect(mockUseFolderReadme).toHaveBeenLastCalledWith('test-repo', contributing.path);
    });

    it('falls back to the README when ?docTab= names a doc that is not in the folder', () => {
      // Typo, or the file was removed by a later pull.
      setDocs({ docs: [readmeDoc, doc('contributing', 'CONTRIBUTING.md')] });

      render(<FolderReadmePanel folderUID="test-folder" />, {
        historyOptions: { initialEntries: ['/?docTab=DELETED.md'] },
      });

      expect(screen.getByRole('tab', { name: 'README' })).toHaveAttribute('aria-selected', 'true');
      expect(mockUseFolderReadme).toHaveBeenLastCalledWith('test-repo', readmeDoc.path);
    });

    it('reports "other" for a non-convention doc selection', async () => {
      const changelog = doc(undefined, 'CHANGELOG.md');
      setDocs({ docs: [readmeDoc, changelog] });
      const { user } = setup();

      await user.click(screen.getByRole('tab', { name: 'CHANGELOG' }));

      expect(tabSelectedSpy).toHaveBeenCalledWith({ repositoryType: 'github', doc: 'other' });
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
    const memoryItem: ResourceListItem = { ...dashboardItem, name: 'memory', path: 'dashboards/team-a/memory.json' };
    const folderItem: ResourceListItem = {
      ...dashboardItem,
      resource: 'folders',
      name: 'fold1',
      path: 'dashboards/team-a',
    };
    const cachedResult = (path: string) =>
      provisioningAPIv0alpha1.endpoints.resolveRepositoryResources.select({
        name: 'test-repo',
        resourceResolveRequest: { paths: [path] },
      })(getState());

    it('prefetches unique resource paths together and reuses them for dashboard and doc links', async () => {
      const { batches, listing } = setResources([dashboardItem, memoryItem, folderItem]);
      setDocs({ repository: { ...mockRepository, path: 'grafana' } });
      setReadmeResult({
        markdownContent: '[CPU](cpu.json) [Again](./cpu.json) [Memory](memory.json) [Folder](./) [Doc](NOTES.md)',
      });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();

      await waitFor(() => expect(cachedResult('dashboards/team-a').data?.results[0].resource?.name).toBe('fold1'));
      expect(batches.mock.calls).toEqual([
        [['dashboards/team-a/cpu.json', 'dashboards/team-a/memory.json', 'dashboards/team-a']],
      ]);
      expect(listing).not.toHaveBeenCalled();
      expect(pushSpy).not.toHaveBeenCalled();
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await user.click(screen.getByRole('link', { name: 'Memory' }));
      await user.click(screen.getByRole('link', { name: 'Doc' }));
      expect(pushSpy.mock.calls).toEqual([['/d/abc'], ['/d/memory'], ['/dashboards/f/fold1?docTab=NOTES.md']]);
      expect(batches).toHaveBeenCalledTimes(1);
      expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'in_app' });
    });

    it('limits each prefetch request to 100 unique paths', async () => {
      const { batches } = setResources([]);
      setReadmeResult({
        markdownContent: Array.from({ length: 101 }, (_, index) => `[Dashboard ${index}](dashboard${index}.json)`).join(
          ' '
        ),
      });
      setup();
      await waitFor(() => expect(batches).toHaveBeenCalledTimes(2));
      expect(batches.mock.calls.map(([paths]) => paths.length)).toEqual([100, 1]);
      expect(batches.mock.calls[0][0][0]).toBe('dashboards/team-a/dashboard0.json');
      expect(batches.mock.calls[1]).toEqual([['dashboards/team-a/dashboard100.json']]);
    });

    it('excludes unsupported and outside-root paths without preventing valid links from resolving', async () => {
      const { batches } = setResources([dashboardItem]);
      setDocs({ repository: { ...mockRepository, path: 'grafana' } });
      setReadmeResult({
        markdownContent:
          '[CPU](cpu.json) [Percent](bad%25.json) [Unicode](caf%C3%A9.json) [Hidden](.hidden.json) [Outside](/other/cpu.json) [Root](/grafana/)',
      });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(cachedResult('dashboards/team-a/cpu.json').isSuccess).toBe(true));
      expect(batches.mock.calls).toEqual([[['dashboards/team-a/cpu.json']]]);
      expect(fireEvent.click(screen.getByRole('link', { name: 'Percent' }))).toBe(true);
      expect(fireEvent.click(screen.getByRole('link', { name: 'Outside' }))).toBe(true);
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      expect(pushSpy).toHaveBeenCalledWith('/d/abc');
      expect(batches).toHaveBeenCalledTimes(1);
    });

    it('shares an in-flight prefetch with the clicked link', async () => {
      let release: (() => void) | undefined;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      const requests = jest.fn();
      server.use(
        http.post(`${BASE}/repositories/:name/resources/resolve`, async ({ request }) => {
          requests(await request.json());
          await ready;
          return HttpResponse.json({ results: [{ path: dashboardItem.path, resource: dashboardItem }] });
        })
      );
      setReadmeResult({ markdownContent: '[CPU](cpu.json)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(requests).toHaveBeenCalledWith({ paths: ['dashboards/team-a/cpu.json'] }));
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      expect(pushSpy).not.toHaveBeenCalled();
      await act(async () => {
        release?.();
      });
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
      expect(requests).toHaveBeenCalledTimes(1);
    });

    it.each([undefined, 1])(
      'reuses individual cached paths across documents with syncFinished=%s',
      async (syncFinished) => {
        const { batches } = setResources([dashboardItem, memoryItem]);
        setReadmeResult({ markdownContent: '[CPU](cpu.json) [Memory](memory.json)', syncFinished });
        const { user, rerender } = setup();
        const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
        await waitFor(() => expect(cachedResult('dashboards/team-a/memory.json').isSuccess).toBe(true));
        setReadmeResult({ markdownContent: 'A different document: [Memory](memory.json)', syncFinished });
        rerender(<FolderReadmePanel folderUID="test-folder" />);
        await user.click(screen.getByRole('link', { name: 'Memory' }));
        expect(pushSpy).toHaveBeenCalledWith('/d/memory');
        expect(batches.mock.calls).toEqual([[['dashboards/team-a/cpu.json', 'dashboards/team-a/memory.json']]]);
      }
    );

    it('refreshes only the clicked path when the prefetched result is older than a minute', async () => {
      const { batches } = setResources([dashboardItem, memoryItem]);
      setReadmeResult({ markdownContent: '[CPU](cpu.json) [Memory](memory.json)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(cachedResult('dashboards/team-a/cpu.json').isSuccess).toBe(true));
      const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
      try {
        await user.click(screen.getByRole('link', { name: 'CPU' }));
        await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
        expect(batches.mock.calls).toEqual([
          [['dashboards/team-a/cpu.json', 'dashboards/team-a/memory.json']],
          [['dashboards/team-a/cpu.json']],
        ]);
      } finally {
        now.mockRestore();
      }
    });

    it('reuses freshly prefetched links after a sync completes', async () => {
      const { batches } = setResources([dashboardItem, memoryItem]);
      const markdownContent = '[CPU](cpu.json) [Memory](memory.json)';
      setReadmeResult({ markdownContent, syncFinished: 1 });
      const { user, rerender } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(cachedResult('dashboards/team-a/memory.json').isSuccess).toBe(true));
      setReadmeResult({ markdownContent, syncFinished: 2 });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      await waitFor(() => expect(batches).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(cachedResult('dashboards/team-a/memory.json').isSuccess).toBe(true));
      await user.click(screen.getByRole('link', { name: 'Memory' }));
      expect(pushSpy).toHaveBeenCalledWith('/d/memory');
      expect(batches.mock.calls).toEqual([
        [['dashboards/team-a/cpu.json', 'dashboards/team-a/memory.json']],
        [['dashboards/team-a/cpu.json', 'dashboards/team-a/memory.json']],
      ]);
    });

    it('refreshes a cached lookup when a sync finishes while the markdown is unmounted', async () => {
      setResources([dashboardItem]);
      const markdownContent = '[CPU](cpu.json)';
      setReadmeResult({ markdownContent, syncFinished: 1 });
      const { user, rerender } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(cachedResult('dashboards/team-a/cpu.json').isSuccess).toBe(true));
      setReadmeResult({ status: 'loading' });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      const { batches } = setResources([{ ...dashboardItem, name: 'after-sync' }]);
      setReadmeResult({ markdownContent, syncFinished: Date.now() + 1 });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await waitFor(() => expect(pushSpy).toHaveBeenLastCalledWith('/d/after-sync'));
      expect(batches.mock.calls).toEqual([[['dashboards/team-a/cpu.json']]]);
    });

    it('does not let a pre-sync batch overwrite the refreshed cache', async () => {
      let release: (() => void) | undefined;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      const requests = jest.fn();
      server.use(
        http.post(`${BASE}/repositories/:name/resources/resolve`, async ({ request }) => {
          requests(await request.json());
          const old = requests.mock.calls.length === 1;
          if (old) {
            await ready;
          }
          return HttpResponse.json({
            results: [{ path: dashboardItem.path, resource: { ...dashboardItem, name: old ? 'old' : 'new' } }],
          });
        })
      );
      const markdownContent = '[CPU](cpu.json)';
      setReadmeResult({ markdownContent, syncFinished: 1 });
      const { user, rerender } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(requests).toHaveBeenCalledTimes(1));
      setReadmeResult({ markdownContent, syncFinished: 2 });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      await waitFor(() =>
        expect(cachedResult('dashboards/team-a/cpu.json').data?.results[0].resource?.name).toBe('new')
      );
      await act(async () => {
        release?.();
      });
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      expect(pushSpy).toHaveBeenCalledWith('/d/new');
      expect(requests).toHaveBeenCalledTimes(2);
    });

    it.each([403, 404, 200])('retries failed or unresolved results after status %s', async (status) => {
      const requests = jest.fn();
      server.use(
        http.post(`${BASE}/repositories/:name/resources/resolve`, async ({ request }) => {
          const body = (await request.json()) as { paths: string[] };
          requests(body.paths);
          const resource = requests.mock.calls.length > 2 ? dashboardItem : undefined;
          return HttpResponse.json(
            { results: [{ path: dashboardItem.path, resource }] },
            { status: resource ? 200 : status }
          );
        })
      );
      setReadmeResult({ markdownContent: '[CPU](cpu.json)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() =>
        expect(cachedResult('dashboards/team-a/cpu.json').status).toBe(status === 200 ? 'fulfilled' : 'rejected')
      );
      const assignMock = jest.fn();
      const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, assign: assignMock },
      });
      try {
        await user.click(screen.getByRole('link', { name: 'CPU' }));
        await waitFor(() =>
          expect(assignMock).toHaveBeenCalledWith('https://github.com/owner/repo/blob/main/dashboards/team-a/cpu.json')
        );
        expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'host' });
        await user.click(screen.getByRole('link', { name: 'CPU' }));
        await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
        expect(requests.mock.calls).toEqual([
          [['dashboards/team-a/cpu.json']],
          [['dashboards/team-a/cpu.json']],
          [['dashboards/team-a/cpu.json']],
        ]);
      } finally {
        if (originalLocation) {
          Object.defineProperty(window, 'location', originalLocation);
        }
      }
    });

    it('keeps accessible results from a partially unresolved batch', async () => {
      const { batches } = setResources([dashboardItem]);
      setReadmeResult({ markdownContent: '[CPU](cpu.json) [Hidden](hidden.json)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() =>
        expect(cachedResult('dashboards/team-a/cpu.json').data?.results[0].resource?.name).toBe('abc')
      );
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      expect(pushSpy).toHaveBeenCalledWith('/d/abc');
      expect(cachedResult('dashboards/team-a/hidden.json').data).toBeUndefined();
      expect(batches.mock.calls).toEqual([[['dashboards/team-a/cpu.json', 'dashboards/team-a/hidden.json']]]);
    });

    it.each([
      { link: './', route: '/dashboards/f/fold1' },
      { link: './_folder.json', route: '/dashboards/f/fold1' },
      { link: './README.md', route: '/dashboards/f/fold1?docTab=README.md' },
    ])('looks up the folder resource for $link', async ({ link, route }) => {
      const { batches } = setResources([folderItem]);
      setReadmeResult({ markdownContent: `[Folder](${link})` });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await user.click(screen.getByRole('link', { name: 'Folder' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith(route));
      expect(batches.mock.calls).toEqual([[['dashboards/team-a']]]);
    });

    it.each([
      { link: '/README.md', route: '/dashboards/f/root?docTab=README.md' },
      { link: '/', route: '/dashboards/f/root' },
    ])('loads the admin listing only when the root link $link is clicked', async ({ link, route }) => {
      const { batches, listing } = setResources([{ ...folderItem, path: '', name: 'root' }]);
      setReadmeResult({ markdownContent: `[Root](${link})` });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      expect(listing).not.toHaveBeenCalled();
      await user.click(screen.getByRole('link', { name: 'Root' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith(route));
      expect(listing).toHaveBeenCalledTimes(1);
      expect(batches).not.toHaveBeenCalled();
    });

    it('preserves modified-click navigation to the host after prefetching', async () => {
      const { batches } = setResources([dashboardItem]);
      setReadmeResult({ markdownContent: '[CPU](cpu.json)' });
      setup();
      await waitFor(() => expect(cachedResult('dashboards/team-a/cpu.json').isSuccess).toBe(true));
      const anchor = screen.getByRole('link', { name: 'CPU' });
      expect(anchor).toHaveAttribute('href', 'https://github.com/owner/repo/blob/main/dashboards/team-a/cpu.json');
      expect(fireEvent.click(anchor, { ctrlKey: true })).toBe(true);
      expect(batches).toHaveBeenCalledTimes(1);
    });

    it('does not navigate an older pending lookup after a cached link is clicked', async () => {
      let release: (() => void) | undefined;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.post(`${BASE}/repositories/:name/resources/resolve`, async ({ request }) => {
          const { paths } = (await request.json()) as { paths: string[] };
          if (paths.length > 1) {
            return HttpResponse.json({
              results: [{ path: memoryItem.path, resource: memoryItem }, { path: dashboardItem.path }],
            });
          }
          await ready;
          return HttpResponse.json({ results: [{ path: dashboardItem.path, resource: dashboardItem }] });
        })
      );
      setReadmeResult({ markdownContent: '[CPU](cpu.json) [Memory](memory.json)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(cachedResult('dashboards/team-a/memory.json').isSuccess).toBe(true));
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await user.click(screen.getByRole('link', { name: 'Memory' }));
      await act(async () => {
        release?.();
      });
      await waitFor(() => expect(cachedResult('dashboards/team-a/cpu.json').isSuccess).toBe(true));
      expect(pushSpy.mock.calls).toEqual([['/d/memory']]);
    });

    it('resolves when the click lands on an SVG element inside the link', async () => {
      setResources([dashboardItem]);
      setReadmeResult({ markdownContent: 'See [CPU](cpu.json)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      const link = screen.getByRole('link', { name: 'CPU' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      link.appendChild(svg);
      await user.click(svg);
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
    });

    it('keeps prefetched results scoped to their repository after switching repos', async () => {
      const requests = jest.fn();
      server.use(
        http.post(`${BASE}/repositories/:name/resources/resolve`, async ({ params, request }) => {
          const { paths } = (await request.json()) as { paths: string[] };
          requests(params.name, paths);
          if (params.name === 'repo-b') {
            await delay(50);
          }
          return HttpResponse.json({
            results: [
              {
                path: dashboardItem.path,
                resource: { ...dashboardItem, name: params.name === 'repo-b' ? 'bbb' : 'aaa' },
              },
            ],
          });
        })
      );
      setDocs({ repository: { ...mockRepository, name: 'repo-a' } });
      setReadmeResult({ markdownContent: '[CPU](cpu.json)' });
      const { user, rerender } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/aaa'));
      setDocs({ repository: { ...mockRepository, name: 'repo-b' } });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      pushSpy.mockClear();
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/bbb'));
      expect(pushSpy.mock.calls).toEqual([['/d/bbb']]);
      expect(requests.mock.calls).toEqual([
        ['repo-a', ['dashboards/team-a/cpu.json']],
        ['repo-b', ['dashboards/team-a/cpu.json']],
      ]);
    });
  });

  describe('Add README empty state (README file missing)', () => {
    beforeEach(() => {
      // useFolderDocs always lists a README tab, synthesized when the file is absent.
      setDocs({ docs: [readmeDoc] });
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

    it('shows a load error, not the Add README prompt, when a non-README doc is missing', () => {
      // The tab came from the file listing, so a 404 is a load failure rather than an absent README.
      setDocs({ docs: [readmeDoc, doc('security', 'SECURITY.md')] });

      render(<FolderReadmePanel folderUID="test-folder" />, {
        historyOptions: { initialEntries: ['/?docTab=SECURITY.md'] },
      });

      expect(screen.getByText(/Couldn't load this document/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
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
    setDocs({ repository: undefined, docs: [readmeDoc] });
    setReadmeResult({ status: 'loading', markdownContent: undefined });

    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading indicator while discovery is in progress', () => {
    setDocs({ repository: undefined, docs: [readmeDoc], isLoading: true });
    setReadmeResult({ status: 'loading', markdownContent: undefined });

    setup();
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
  });

  it('shows a loading indicator while the doc content is loading', () => {
    setReadmeResult({ status: 'loading', markdownContent: undefined });

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

  // The renderer itself is covered in core/utils/mermaid.test.ts and
  // core/hooks/useMermaidDiagrams.test.ts; this only checks the README is wired to it.
  it('renders a ```mermaid fenced block as a diagram', async () => {
    setReadmeResult({ markdownContent: '## Flow\n\n```mermaid\ngraph TD; A-->B;\n```' });

    setup();

    expect(await screen.findByTestId('mermaid-svg')).toBeInTheDocument();
    expect(screen.getByText('Flow')).toBeInTheDocument();
    // The source code block is replaced by the rendered diagram.
    expect(screen.queryByText('graph TD; A-->B;')).not.toBeInTheDocument();
  });

  it('keeps the diagram and does not draw again when the panel re-renders with the same README', async () => {
    setReadmeResult({ markdownContent: '## Flow\n\n```mermaid\ngraph TD; A-->B;\n```' });

    const { rerender } = setup();
    await screen.findByTestId('mermaid-svg');
    const drawCalls = mockMermaidRender.mock.calls.length;

    rerender(<FolderReadmePanel folderUID="test-folder" />);
    // Let any effect the re-render might have queued settle before asserting.
    await act(async () => {});

    expect(screen.getByTestId('mermaid-svg')).toBeInTheDocument();
    expect(mockMermaidRender).toHaveBeenCalledTimes(drawCalls);
  });
});
