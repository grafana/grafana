import { act, render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { type UseFolderDocsResult, useFolderDocs } from '../../hooks/useFolderDocs';
import { type UseFolderReadmeResult, useFolderReadme } from '../../hooks/useFolderReadme';
import { type FolderDocMatch } from '../../utils/folderDocConventions';

import { FOLDER_README_ANCHOR_ID, FolderReadmePanel } from './FolderReadmePanel';
import { FolderReadmeEvents } from './analytics/main';

jest.mock('../../hooks/useFolderDocs');
jest.mock('../../hooks/useFolderReadme');

const mockUseFolderDocs = useFolderDocs as jest.MockedFunction<typeof useFolderDocs>;
const mockUseFolderReadme = useFolderReadme as jest.MockedFunction<typeof useFolderReadme>;
const editClickedSpy = jest.spyOn(FolderReadmeEvents, 'editClicked').mockImplementation();
const createClickedSpy = jest.spyOn(FolderReadmeEvents, 'createClicked').mockImplementation();
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

function doc(key: FolderDocMatch['convention']['key'], fileName: string): FolderDocMatch {
  return { convention: { key, fileName, matches: [fileName] }, path: `dashboards/team-a/${fileName}`, fileName };
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
    markdownContent: '# Hello\n\nThis is a README.',
    refetch: jest.fn(),
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

    const editLink = screen.getByRole('link', { name: /Edit README\.md/i });
    expect(editLink).toHaveAttribute('href', 'https://github.com/owner/repo/edit/main/dashboards/team-a/README.md');
  });

  it('prefixes the edit URL with repository.path when configured', () => {
    setDocs({ repository: { ...mockRepository, path: 'ops/resources' } });
    setup();

    expect(screen.getByRole('link', { name: /Edit README\.md/i })).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/edit/main/ops/resources/dashboards/team-a/README.md'
    );
  });

  it('reports an interaction when the edit link is clicked', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: /Edit README\.md/i }));

    expect(editClickedSpy).toHaveBeenCalledWith({ repositoryType: 'github' });
  });

  describe('documentation tabs', () => {
    it('renders a tab per recognized convention doc, GitHub-style', () => {
      setDocs({
        docs: [
          readmeDoc,
          doc('code-of-conduct', 'CODE_OF_CONDUCT.md'),
          doc('contributing', 'CONTRIBUTING.md'),
          doc('license', 'LICENSE'),
          doc('security', 'SECURITY.md'),
        ],
      });
      setup();

      expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Code of conduct' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Contributing' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'License' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument();
    });

    it('switches the active doc and reports an interaction when a tab is clicked', async () => {
      const contributing = doc('contributing', 'CONTRIBUTING.md');
      setDocs({ docs: [readmeDoc, contributing] });
      const { user } = setup();

      await user.click(screen.getByRole('tab', { name: 'Contributing' }));

      expect(mockUseFolderReadme).toHaveBeenLastCalledWith('test-folder', contributing.path);
      expect(tabSelectedSpy).toHaveBeenCalledWith({ repositoryType: 'github', doc: 'contributing' });
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
    expect(screen.queryByText(/Unable to display README content/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'README' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit README\.md/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
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
