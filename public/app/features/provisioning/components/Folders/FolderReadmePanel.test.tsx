import mermaid from 'mermaid';
import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { RepoViewStatus, useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { createRepository } from '../../mocks/factories';
import { setupProvisioningMswServer } from '../../mocks/server';

import { FOLDER_README_ANCHOR_ID, FolderReadmePanel } from './FolderReadmePanel';
import { FolderReadmeEvents } from './analytics/main';

// Repo resolution (frontend settings + folder + manager annotations) is mocked
// here the same way the sibling useFolderReadme.test.ts does it; the README file
// itself flows through the real useFolderReadme hook and RTK Query, backed by MSW.
jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('../../hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

// mermaid is a heavy browser-only library; mock the module so tests can assert the
// rendered diagram wiring without pulling in its full runtime.
jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), render: jest.fn() },
}));

setupProvisioningMswServer();

const mockRepoView = jest.mocked(useGetResourceRepositoryView);
const mockMermaidRender = mermaid.render as jest.MockedFunction<typeof mermaid.render>;
const editClickedSpy = jest.spyOn(FolderReadmeEvents, 'editClicked').mockImplementation();
const createClickedSpy = jest.spyOn(FolderReadmeEvents, 'createClicked').mockImplementation();

const REPO: RepositoryView = {
  name: 'test-folder',
  target: 'folder',
  title: 'Test Repository',
  type: 'github',
  url: 'https://github.com/owner/repo',
  branch: 'main',
  workflows: [],
};

const FOLDER = {
  metadata: {
    name: 'test-folder',
    annotations: { [AnnoKeySourcePath]: 'dashboards/team-a' },
  },
  spec: { title: 'Test Folder' },
  status: {},
} as never;

/** Overrides the resolved repository view returned to useFolderReadme. */
function setRepoView(overrides: Partial<ReturnType<typeof useGetResourceRepositoryView>> = {}) {
  mockRepoView.mockReturnValue({
    repository: REPO,
    folder: FOLDER,
    status: RepoViewStatus.Ready,
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
    ...overrides,
  });
}

/**
 * Registers the README file endpoint and the repositories watch list, returning
 * a hit counter for the file endpoint (used to assert refetches). Pass a status
 * to exercise the missing (404) / error (500) branches.
 */
function setReadmeFile(content: string, { status = 200 }: { status?: number } = {}) {
  let fileHits = 0;
  server.use(
    http.get(`${BASE}/repositories`, () =>
      HttpResponse.json({ items: [createRepository()], metadata: { resourceVersion: '1' } })
    ),
    http.get(`${BASE}/repositories/:name/files/*`, () => {
      fileHits++;
      if (status !== 200) {
        return new HttpResponse(null, { status });
      }
      return HttpResponse.json({ resource: { file: content } });
    })
  );
  return { getFileHits: () => fileHits };
}

function setup(folderUID = 'test-folder') {
  return render(<FolderReadmePanel folderUID={folderUID} />);
}

describe('FolderReadmePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestFlags({ 'provisioning.readmes': true });
    setRepoView();
    mockMermaidRender.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"></svg>' } as never);
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('renders the README markdown inside a panel with an anchor id', async () => {
    setReadmeFile('# Hello\n\nThis is a README.');

    const { container } = setup();

    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(container.querySelector(`#${FOLDER_README_ANCHOR_ID}`)).not.toBeNull();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('This is a README.')).toBeInTheDocument();
  });

  it('shows an Edit README icon button targeting the host editor when a README exists', async () => {
    setReadmeFile('# Hello');

    setup();

    const editLink = await screen.findByRole('link', { name: /Edit README/i });
    expect(editLink).toHaveAttribute('href', 'https://github.com/owner/repo/edit/main/dashboards/team-a/README.md');
  });

  it('prefixes the edit URL with repository.path when configured', async () => {
    setRepoView({ repository: { ...REPO, path: 'ops/resources' } });
    setReadmeFile('# Hello');

    setup();

    expect(await screen.findByRole('link', { name: /Edit README/i })).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/edit/main/ops/resources/dashboards/team-a/README.md'
    );
  });

  it('reports an interaction when the edit link is clicked', async () => {
    setReadmeFile('# Hello');

    const { user } = setup();
    await user.click(await screen.findByRole('link', { name: /Edit README/i }));

    expect(editClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github' });
  });

  describe('Add README empty state (status: missing)', () => {
    it('renders the Add README button when no README exists', async () => {
      setReadmeFile('', { status: 404 });

      setup();

      const addLink = await screen.findByRole('link', { name: /Add README/i });
      const href = addLink.getAttribute('href') ?? '';
      expect(href).toMatch(/^https:\/\/github\.com\/owner\/repo\/new\/main\?filename=dashboards%2Fteam-a%2FREADME\.md/);
      const value = decodeURIComponent(new URL(href).searchParams.get('value') ?? '');
      expect(value).toContain('# Test Folder');
    });

    it('reports an interaction when the Add README button is clicked', async () => {
      setReadmeFile('', { status: 404 });

      const { user } = setup();
      await user.click(await screen.findByRole('link', { name: /Add README/i }));

      expect(createClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github' });
    });

    it('hides the Edit icon when no README exists', async () => {
      setReadmeFile('', { status: 404 });

      setup();

      await screen.findByRole('link', { name: /Add README/i });
      expect(screen.queryByRole('link', { name: /Edit README/i })).not.toBeInTheDocument();
    });
  });

  describe('error state (status: error)', () => {
    it('renders a warning alert with a retry button', async () => {
      setReadmeFile('', { status: 500 });

      setup();

      expect(await screen.findByText(/Couldn.t load README/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
    });

    it('refetches the README when the retry button is clicked', async () => {
      const { getFileHits } = setReadmeFile('', { status: 500 });

      const { user } = setup();

      await screen.findByRole('button', { name: /Try again/i });
      const hitsBeforeRetry = getFileHits();
      await user.click(screen.getByRole('button', { name: /Try again/i }));

      await waitFor(() => expect(getFileHits()).toBeGreaterThan(hitsBeforeRetry));
    });

    it('hides the Edit pencil in error state', async () => {
      setReadmeFile('', { status: 500 });

      setup();

      await screen.findByText(/Couldn.t load README/);
      expect(screen.queryByRole('link', { name: /Edit README/i })).not.toBeInTheDocument();
    });

    it('does not show the Add README CTA in error state', async () => {
      setReadmeFile('', { status: 500 });

      setup();

      await screen.findByText(/Couldn.t load README/);
      expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
    });
  });

  it('renders nothing when the feature toggle is off', () => {
    setTestFlags({ 'provisioning.readmes': false });

    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setRepoView({ repository: undefined, folder: undefined, isMissingRepo: true });

    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading indicator while the repository view is loading', () => {
    setRepoView({ repository: undefined, folder: undefined, status: RepoViewStatus.Loading, isLoading: true });

    setup();
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('shows a loading indicator while the README file is loading', () => {
    setReadmeFile('# Hello');

    setup();
    // The file request is still in flight on first render.
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });

  it('renders an empty README without the parse-error message', async () => {
    setReadmeFile('');

    setup();

    expect(await screen.findByRole('link', { name: /Edit README/i })).toBeInTheDocument();
    expect(screen.queryByText(/Unable to display README content/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
  });

  describe('mermaid diagrams', () => {
    it('renders a ```mermaid fenced block as a diagram', async () => {
      setReadmeFile('## Flow\n\n```mermaid\ngraph TD; A-->B;\n```');

      const { container } = setup();

      expect(await screen.findByTestId('mermaid-svg')).toBeInTheDocument();
      // The source code block is replaced by the rendered diagram.
      expect(container.querySelector('code.language-mermaid')).toBeNull();
    });

    it('renders multiple mermaid diagrams in the same README', async () => {
      setReadmeFile(
        [
          '## One',
          '',
          '```mermaid',
          'graph TD; A-->B;',
          '```',
          '',
          '## Two',
          '',
          '```mermaid',
          'graph LR; C-->D;',
          '```',
        ].join('\n')
      );

      const { container } = setup();

      // Both fenced blocks are turned into diagrams. (Render call count isn't asserted:
      // React StrictMode double-invokes the effect, so it can exceed the diagram count.)
      await waitFor(() => expect(container.querySelectorAll('.markdown-mermaid')).toHaveLength(2));
    });

    it('keeps the source and flags the block when a diagram fails to render', async () => {
      mockMermaidRender.mockRejectedValue(new Error('parse error'));
      setReadmeFile('## Broken\n\n```mermaid\nnot a real diagram\n```');

      const { container } = setup();

      await waitFor(() => expect(container.querySelector('.markdown-mermaid-error')).not.toBeNull());
      // A broken diagram leaves its source visible instead of hiding the README.
      expect(screen.getByText(/not a real diagram/)).toBeInTheDocument();
      expect(screen.getByText('Broken')).toBeInTheDocument();
    });

    it('does not render diagrams for READMEs without mermaid blocks', async () => {
      setReadmeFile('# Hello\n\nNo diagrams here.');

      const { container } = setup();

      await screen.findByText('Hello');
      expect(mockMermaidRender).not.toHaveBeenCalled();
      expect(container.querySelector('.markdown-mermaid')).toBeNull();
    });
  });

  it('sanitizes mXSS payloads in README markdown', async () => {
    setReadmeFile('<div><svg><style><img src=x onerror=alert(1)></style></svg></div>');

    const { container } = setup();

    await waitFor(() => expect(container.querySelector('.markdown-html')).not.toBeNull());
    const markdownDiv = container.querySelector('.markdown-html');
    // DOMPurify strips the dangerous elements.
    expect(markdownDiv!.querySelector('img[onerror]')).toBeNull();
    expect(markdownDiv!.innerHTML).not.toContain('onerror');
  });
});
