import mermaid from 'mermaid';
import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor, within } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';

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

function resourceItem(path: string, name: string, resource = 'dashboards'): ResourceListItem {
  return {
    path,
    name,
    resource,
    group: resource === 'folders' ? 'folder.grafana.app' : 'dashboard.grafana.app',
    hash: '',
  };
}

function setResources(items: ResourceListItem[]) {
  const requests = jest.fn();
  server.use(
    http.post(`${BASE}/repositories/:name/resources`, async ({ request }) => {
      requests(request.url, await request.json());
      return HttpResponse.json({ items });
    })
  );
  return requests;
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
    // locationUtil keeps module-level config, so reset it between tests
    locationUtil.initialize({
      config: { appSubUrl: '' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
    setDocs();
    setReadmeResult();
    mockMermaidRender.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"></svg>', diagramType: 'flowchart' });
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
    it('resolves deduplicated paths on load and navigates without another request', async () => {
      const requests = setResources([resourceItem('dashboards/team-a/cpu.json', 'abc')]);
      setReadmeResult({ markdownContent: 'See [CPU](cpu.json) and [same dashboard](./cpu.json?var-env=prod#panel-1)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();

      await waitFor(() => expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute('href', '/d/abc'));
      expect(screen.getByRole('link', { name: 'same dashboard' })).toHaveAttribute(
        'href',
        '/d/abc?var-env=prod#panel-1'
      );
      expect(requests.mock.calls).toEqual([
        [
          'http://localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/test-repo/resources',
          { paths: ['dashboards/team-a/cpu.json'] },
        ],
      ]);
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      expect(pushSpy).toHaveBeenCalledWith('/d/abc');
      expect(requests).toHaveBeenCalledTimes(1);
      expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'in_app' });
    });

    it('resolves folders, metadata, root and Markdown docs in the same batch', async () => {
      const requests = setResources([
        resourceItem('dashboards/team-a/', 'team', 'folders'),
        resourceItem('/', 'root', 'folders'),
      ]);
      setDocs({ repository: { ...mockRepository, path: 'ops/resources' } });
      setReadmeResult({
        markdownContent:
          '[folder](./) [metadata](./_folder.json) [doc](./CONTRIBUTING.md#help) [root](../../README.md)',
      });
      setup();

      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'folder' })).toHaveAttribute('href', '/dashboards/f/team')
      );
      expect(screen.getByRole('link', { name: 'metadata' })).toHaveAttribute('href', '/dashboards/f/team');
      expect(screen.getByRole('link', { name: 'doc' })).toHaveAttribute(
        'href',
        '/dashboards/f/team?docTab=CONTRIBUTING.md#help'
      );
      expect(screen.getByRole('link', { name: 'root' })).toHaveAttribute('href', '/dashboards/f/root?docTab=README.md');
      expect(requests.mock.calls[0][1]).toEqual({ paths: ['dashboards/team-a/', '/'] });
    });

    it('keeps denied and missing resources on the host while resolving allowed links', async () => {
      setResources([resourceItem('dashboards/team-a/allowed.json', 'allowed')]);
      setReadmeResult({ markdownContent: '[allowed](allowed.json) [denied](denied.json) [missing](missing.json)' });
      setup();

      await waitFor(() => expect(screen.getByRole('link', { name: 'allowed' })).toHaveAttribute('href', '/d/allowed'));
      for (const name of ['denied', 'missing']) {
        expect(screen.getByRole('link', { name })).toHaveAttribute(
          'href',
          `https://github.com/owner/repo/blob/main/dashboards/team-a/${name}.json`
        );
        expect(screen.getByRole('link', { name })).toHaveAttribute('target', '_blank');
      }
    });

    it('preserves native modified-click behavior with a resolved href', async () => {
      setResources([resourceItem('dashboards/team-a/cpu.json', 'abc')]);
      setReadmeResult({ markdownContent: '[CPU](./cpu.json)' });
      setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await waitFor(() => expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute('href', '/d/abc'));
      const prevented = jest.fn();
      const preventNavigation = (event: MouseEvent) => {
        prevented(event.defaultPrevented);
        event.preventDefault();
      };
      document.addEventListener('click', preventNavigation);
      try {
        screen
          .getByRole('link', { name: 'CPU' })
          .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
        expect(prevented).toHaveBeenCalledWith(false);
        expect(pushSpy).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener('click', preventNavigation);
      }
    });

    it('refreshes resolved links after a sync even when Markdown is unchanged', async () => {
      const requests = setResources([resourceItem('dashboards/team-a/cpu.json', 'before')]);
      setReadmeResult({ markdownContent: '[CPU](./cpu.json)', syncFinished: 1 });
      const { rerender } = setup();
      await waitFor(() => expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute('href', '/d/before'));

      const refreshed = setResources([resourceItem('dashboards/team-a/cpu.json', 'after')]);
      setReadmeResult({ markdownContent: '[CPU](./cpu.json)', syncFinished: 2 });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      await waitFor(() => expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute('href', '/d/after'));
      expect(requests).toHaveBeenCalledTimes(1);
      expect(refreshed).toHaveBeenCalledTimes(1);
    });

    it.each(['repository', 'document'])('ignores late responses after switching %s', async (change) => {
      let finishOldRequest!: () => void;
      const pending = new Promise<void>((resolve) => {
        finishOldRequest = resolve;
      });
      const started = jest.fn();
      server.use(
        http.post(`${BASE}/repositories/:name/resources`, async ({ request }) => {
          const body = await request.json();
          started(body);
          if (started.mock.calls.length === 1) {
            await pending;
            return HttpResponse.json({ items: [resourceItem('dashboards/team-a/cpu.json', 'stale')] });
          }
          return HttpResponse.json({ items: [resourceItem('dashboards/team-a/cpu.json', 'current')] });
        })
      );
      setReadmeResult({ markdownContent: '[CPU](./cpu.json)' });
      const { rerender } = setup();
      await waitFor(() => expect(started).toHaveBeenCalledTimes(1));

      if (change === 'repository') {
        setDocs({ repository: { ...mockRepository, name: 'other-repo' } });
      } else {
        setReadmeResult({ markdownContent: 'Another document: [CPU](./cpu.json)' });
      }
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      await waitFor(() => expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute('href', '/d/current'));
      await act(async () => {
        finishOldRequest();
        await pending;
      });
      expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute('href', '/d/current');
    });

    it.each([403, 404, 500])('leaves the document usable when lookup returns HTTP %s', async (status) => {
      const requests = jest.fn();
      server.use(
        http.post(`${BASE}/repositories/:name/resources`, () => {
          requests();
          return new HttpResponse(null, { status });
        })
      );
      setReadmeResult({ markdownContent: '# Documentation\n\n[CPU](./cpu.json)' });
      setup();
      await waitFor(() => expect(requests).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('heading', { name: 'Documentation' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute(
        'href',
        'https://github.com/owner/repo/blob/main/dashboards/team-a/cpu.json'
      );
    });

    it('does not fetch resources for a document without candidate links', () => {
      const requests = setResources([]);
      setReadmeResult({ markdownContent: '# Hello\n\n[external](https://grafana.com) [image](image.png)' });
      setup();
      expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
      expect(requests).not.toHaveBeenCalled();
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

  // Parsing and the table's layout are covered in markdownFrontmatter.test.ts and
  // MarkdownFrontmatterTable.test.tsx; these check the document is split and wired up.
  describe('front matter', () => {
    it('resolves body links without interpreting front matter as markdown', async () => {
      const requests = setResources([resourceItem('dashboards/team-a/cpu.json', 'abc')]);
      setReadmeResult({
        markdownContent: '---\ntitle: "See [metadata](metadata.json)"\n---\n[CPU](cpu.json)',
      });

      setup();

      await waitFor(() => expect(screen.getByRole('link', { name: 'CPU' })).toHaveAttribute('href', '/d/abc'));
      const table = screen.getByRole('table', { name: 'Document metadata' });
      expect(within(table).getByRole('cell', { name: 'See [metadata](metadata.json)' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'metadata' })).not.toBeInTheDocument();
      expect(requests.mock.calls.map(([, body]) => body)).toEqual([{ paths: ['dashboards/team-a/cpu.json'] }]);
    });

    it('renders a leading YAML block as a metadata table and the rest as the document', () => {
      setReadmeResult({
        markdownContent: ['---', 'title: Team A', 'tags:', '  - as-code', '---', '# Hello', '', 'Body.'].join('\n'),
      });

      setup();

      const table = screen.getByRole('table', { name: 'Document metadata' });
      expect(within(table).getByRole('rowheader', { name: 'title' })).toBeInTheDocument();
      expect(within(table).getByRole('cell', { name: 'Team A' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
      expect(screen.getByText('Body.')).toBeInTheDocument();
      // Left in the markdown, the opening `---` would render as an <hr> and the
      // closing `---` would turn the YAML into a setext <h2>.
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    });

    it('renders no metadata table when the document has no front matter', () => {
      setup();

      expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders an invalid YAML block as plain markdown, like GitHub does', () => {
      setReadmeResult({ markdownContent: '---\ntitle: [unclosed\n---\n# Hello' });

      setup();

      expect(screen.getByRole('heading', { level: 2, name: 'title: [unclosed' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
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
