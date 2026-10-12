import mermaid from 'mermaid';
import { HttpResponse, delay, http } from 'msw';
import { act, render, screen, waitFor, within } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type ResourceWrapper } from 'app/api/clients/provisioning/v0alpha1';
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

function fileResource(resource: string, name?: string): ResourceWrapper {
  return {
    repository: { name: 'test-repo', namespace: 'default', title: 'Test', type: 'github' },
    resource: {
      type: { group: resource === 'folders' ? 'folder.grafana.app' : 'dashboard.grafana.app', resource },
      existing: name ? { metadata: { name } } : undefined,
      file: { metadata: { name: 'not-synced' } },
    },
  };
}

function setFileResource(response: ResourceWrapper) {
  const requests = jest.fn();
  server.use(
    http.get(`${BASE}/repositories/:name/files/*`, ({ request }) => {
      requests(request.url);
      return HttpResponse.json(response);
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
    const dashboardFile = fileResource('dashboards', 'abc');
    const rootFolder = {
      metadata: {
        name: 'test-repo',
        annotations: { 'grafana.app/managedBy': 'repo', 'grafana.app/managerId': 'test-repo' },
      },
      spec: { title: 'Test Repository' },
    };
    const rootFolderUrl = '/apis/folder.grafana.app/v1beta1/namespaces/default/folders/test-repo';

    it('navigates in-app when a JSON link maps to a synced dashboard', async () => {
      const requests = setFileResource(dashboardFile);
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)' });

      const { user } = setup();
      expect(requests).not.toHaveBeenCalled();
      // Spy after render: test-utils swaps the locationService the component uses.
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await user.click(screen.getByRole('link', { name: 'CPU' }));

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
      expect(requests.mock.calls).toEqual([
        [
          'http://localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/test-repo/files/dashboards/team-a/cpu.json',
        ],
      ]);
      expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'in_app' });
    });

    it('resolves a bare relative link (no ./) that renderMarkdown would otherwise strip', async () => {
      setFileResource(dashboardFile);
      setReadmeResult({ markdownContent: 'See [CPU](cpu.json)' });

      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      const link = screen.getByRole('link', { name: 'CPU' });
      // The href must survive rendering (not be emptied to the app root).
      expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/blob/main/dashboards/team-a/cpu.json');
      await user.click(link);

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
    });

    it.each([
      { link: './', path: 'dashboards/team-a/', route: '/dashboards/f/fold1' },
      { link: './_folder.json', path: 'dashboards/team-a/', route: '/dashboards/f/fold1' },
    ])('resolves $link with a targeted folder lookup', async ({ link, path, route }) => {
      const requests = setFileResource(fileResource('folders', 'fold1'));
      setReadmeResult({ markdownContent: `See [target](${link})` });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();

      await user.click(screen.getByRole('link', { name: 'target' }));

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith(route));
      expect(requests.mock.calls).toEqual([
        [
          `http://localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/test-repo/files/${path}`,
        ],
      ]);
    });

    it.each([
      { link: '../../README.md', route: '/dashboards/f/test-repo?docTab=README.md' },
      { link: '../../', route: '/dashboards/f/test-repo' },
      { link: '../../_folder.json', route: '/dashboards/f/test-repo' },
    ])('resolves $link through the existing folders API', async ({ link, route }) => {
      const requests = jest.fn();
      const fileRequests = setFileResource(fileResource('folders', 'wrong-folder'));
      server.use(
        http.get(rootFolderUrl, ({ request }) => {
          requests(request.url);
          return HttpResponse.json(rootFolder);
        })
      );
      setReadmeResult({ markdownContent: `See [target](${link})` });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();

      await user.click(screen.getByRole('link', { name: 'target' }));

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith(route));
      expect(requests.mock.calls).toEqual([
        ['http://localhost/apis/folder.grafana.app/v1beta1/namespaces/default/folders/test-repo'],
      ]);
      expect(fileRequests).not.toHaveBeenCalled();
    });

    it.each([
      { description: 'access is denied', status: 403, annotations: rootFolder.metadata.annotations },
      { description: 'the folder is missing', status: 404, annotations: rootFolder.metadata.annotations },
      { description: 'the folder is unmanaged', status: 200, annotations: {} },
      {
        description: 'another repository owns the folder',
        status: 200,
        annotations: { ...rootFolder.metadata.annotations, 'grafana.app/managerId': 'another-repo' },
      },
      {
        description: 'the folder has a non-root source path',
        status: 200,
        annotations: { ...rootFolder.metadata.annotations, 'grafana.app/sourcePath': 'team-a' },
      },
    ])('leaves root links on the host when $description', async ({ status, annotations }) => {
      server.use(
        http.get(rootFolderUrl, () =>
          HttpResponse.json({ ...rootFolder, metadata: { ...rootFolder.metadata, annotations } }, { status })
        )
      );
      setReadmeResult({ markdownContent: 'See [root doc](../../README.md)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      const assignMock = jest.fn();
      const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', { configurable: true, value: { assign: assignMock } });
      try {
        await user.click(screen.getByRole('link', { name: 'root doc' }));

        await waitFor(() =>
          expect(assignMock).toHaveBeenCalledWith('https://github.com/owner/repo/blob/main/README.md')
        );
        expect(pushSpy).not.toHaveBeenCalled();
      } finally {
        if (originalLocation) {
          Object.defineProperty(window, 'location', originalLocation);
        }
      }
    });

    it('leaves instance-scoped root links on the host without guessing a folder UID', async () => {
      const requests = jest.fn();
      server.use(
        http.get(rootFolderUrl, () => {
          requests();
          return HttpResponse.json(rootFolder);
        })
      );
      setDocs({ repository: { ...mockRepository, target: 'instance' } });
      setReadmeResult({ markdownContent: 'See [root doc](../../README.md)' });
      const { user } = setup();
      const assignMock = jest.fn();
      const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', { configurable: true, value: { assign: assignMock } });
      try {
        await user.click(screen.getByRole('link', { name: 'root doc' }));

        await waitFor(() =>
          expect(assignMock).toHaveBeenCalledWith('https://github.com/owner/repo/blob/main/README.md')
        );
        expect(requests).not.toHaveBeenCalled();
      } finally {
        if (originalLocation) {
          Object.defineProperty(window, 'location', originalLocation);
        }
      }
    });

    it('caches clicked paths and looks them up again after a sync', async () => {
      const requests = setFileResource(dashboardFile);
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)', syncFinished: 1 });
      const { user, rerender } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();

      await user.click(screen.getByRole('link', { name: 'CPU' }));
      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/d/abc'));
      await user.click(screen.getByRole('link', { name: 'CPU' }));
      expect(pushSpy).toHaveBeenCalledTimes(2);
      expect(requests).toHaveBeenCalledTimes(1);

      const nextRequests = setFileResource(fileResource('dashboards', 'after-sync'));
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)', syncFinished: 2 });
      rerender(<FolderReadmePanel folderUID="test-folder" />);
      await user.click(screen.getByRole('link', { name: 'CPU' }));

      await waitFor(() => expect(pushSpy).toHaveBeenLastCalledWith('/d/after-sync'));
      expect(nextRequests).toHaveBeenCalledTimes(1);
    });

    it.each([403, 404, 500])('falls back to the host when the file lookup returns HTTP %s', async (status) => {
      server.use(http.get(`${BASE}/repositories/:name/files/*`, () => new HttpResponse(null, { status })));
      setReadmeResult({ markdownContent: 'See [CPU](./cpu.json)' });
      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      const assignMock = jest.fn();
      const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', { configurable: true, value: { assign: assignMock } });
      try {
        await user.click(screen.getByRole('link', { name: 'CPU' }));
        await waitFor(() =>
          expect(assignMock).toHaveBeenCalledWith('https://github.com/owner/repo/blob/main/dashboards/team-a/cpu.json')
        );
        expect(pushSpy).not.toHaveBeenCalled();
      } finally {
        if (originalLocation) {
          Object.defineProperty(window, 'location', originalLocation);
        }
      }
    });

    it('resolves when the click lands on a non-HTML element inside the link (e.g. an SVG icon)', async () => {
      setFileResource(dashboardFile);
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
      setFileResource(fileResource('dashboards'));
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

    it('resolves against the current repository after switching repos (no stale lookup)', async () => {
      // Same path in each repo maps to a different dashboard. repo-b is delayed so
      // that, without a remount, a stale synchronous read of repo-a's listing would
      // push /d/aaa immediately (before repo-b's refetch resolves).
      server.use(
        http.get(`${BASE}/repositories/:name/files/*`, async ({ params }) => {
          const isB = params.name === 'repo-b';
          if (isB) {
            await delay(50);
          }
          return HttpResponse.json(fileResource('dashboards', isB ? 'bbb' : 'aaa'));
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

    it('navigates in-app to the containing folder doc tab when a markdown link maps to a synced folder', async () => {
      // A folder is keyed by its directory; the doc's containing folder resolves it.
      const requests = setFileResource(fileResource('folders', 'fold1'));
      setReadmeResult({ markdownContent: 'See [contributing](./CONTRIBUTING.md)' });

      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      await user.click(screen.getByRole('link', { name: 'contributing' }));

      await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/dashboards/f/fold1?docTab=CONTRIBUTING.md'));
      expect(requests.mock.calls).toEqual([
        [
          'http://localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/test-repo/files/dashboards/team-a/',
        ],
      ]);
      expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'in_app' });
    });

    it('navigates the current tab to the host URL when a markdown link has no synced folder', async () => {
      setFileResource(fileResource('folders'));
      const assignMock = jest.fn();
      setReadmeResult({ markdownContent: 'See [notes](./notes.md)' });

      const { user } = setup();
      const pushSpy = jest.spyOn(locationService, 'push').mockImplementation();
      // window.location.assign is read-only in jsdom; replace it after render.
      const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', { configurable: true, value: { assign: assignMock } });
      try {
        const link = screen.getByRole('link', { name: 'notes' });
        expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/blob/main/dashboards/team-a/notes.md');
        await user.click(link);

        await waitFor(() =>
          expect(assignMock).toHaveBeenCalledWith('https://github.com/owner/repo/blob/main/dashboards/team-a/notes.md')
        );
        expect(pushSpy).not.toHaveBeenCalled();
        expect(linkClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github', outcome: 'host' });
      } finally {
        if (originalLocation) {
          Object.defineProperty(window, 'location', originalLocation);
        }
      }
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
