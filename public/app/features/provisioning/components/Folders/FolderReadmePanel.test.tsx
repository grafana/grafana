import { fireEvent, render, screen } from '@testing-library/react';

import { config, reportInteraction } from '@grafana/runtime';

import { useFolderReadme } from '../../hooks/useFolderReadme';

import { FOLDER_README_ANCHOR_ID, FolderReadmePanel } from './FolderReadmePanel';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('../../hooks/useFolderReadme');

const mockUseFolderReadme = useFolderReadme as jest.MockedFunction<typeof useFolderReadme>;
const mockReportInteraction = reportInteraction as jest.MockedFunction<typeof reportInteraction>;

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

function setReadmeResult(overrides: Partial<ReturnType<typeof useFolderReadme>> = {}) {
  mockUseFolderReadme.mockReturnValue({
    repository: mockRepository,
    folder: mockFolder,
    readmePath: 'dashboards/team-a/README.md',
    isRepoLoading: false,
    isFileLoading: false,
    isError: false,
    fileData: { resource: { file: { content: '# Hello\n\nThis is a README.' } } } as never,
    ...overrides,
  });
}

describe('FolderReadmePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { provisioningReadmes: true };
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

  it('reports an interaction when the edit link is clicked', () => {
    setReadmeResult();

    render(<FolderReadmePanel folderUID="test-folder" />);
    fireEvent.click(screen.getByRole('link', { name: /Edit README/i }));

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_edit_clicked', {
      repositoryType: 'github',
    });
  });

  describe('Add README empty state', () => {
    it('renders the Add README button when no README exists', () => {
      setReadmeResult({ isError: true, fileData: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);

      const addLink = screen.getByRole('link', { name: /Add README/i });
      const href = addLink.getAttribute('href') ?? '';
      expect(href).toMatch(/^https:\/\/github\.com\/owner\/repo\/new\/main\?filename=dashboards%2Fteam-a%2FREADME\.md/);
      const value = decodeURIComponent(new URL(href).searchParams.get('value') ?? '');
      expect(value).toContain('# Test Folder');
    });

    it('reports an interaction when the Add README button is clicked', () => {
      setReadmeResult({ isError: true, fileData: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);
      fireEvent.click(screen.getByRole('link', { name: /Add README/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_create_clicked', {
        repositoryType: 'github',
      });
    });

    it('hides the Edit icon when no README exists', () => {
      setReadmeResult({ isError: true, fileData: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);
      expect(screen.queryByRole('link', { name: /Edit README/i })).not.toBeInTheDocument();
    });
  });

  it('renders nothing when the feature toggle is off', () => {
    config.featureToggles = { provisioningReadmes: false };
    setReadmeResult();

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setReadmeResult({ repository: undefined });

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the repository view is loading', () => {
    setReadmeResult({ isRepoLoading: true });

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a spinner while the README itself is loading', () => {
    setReadmeResult({ isFileLoading: true, fileData: undefined });

    render(<FolderReadmePanel folderUID="test-folder" />);
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });
});
