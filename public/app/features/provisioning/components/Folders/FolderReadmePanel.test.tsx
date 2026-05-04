import { fireEvent, render, screen } from '@testing-library/react';

import { config, reportInteraction } from '@grafana/runtime';

import { type UseFolderReadmeResult, useFolderReadme } from '../../hooks/useFolderReadme';

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

function setReadmeResult(overrides: Partial<UseFolderReadmeResult> = {}) {
  mockUseFolderReadme.mockReturnValue({
    repository: mockRepository,
    folder: mockFolder,
    readmePath: 'dashboards/team-a/README.md',
    status: 'ok',
    markdownContent: '# Hello\n\nThis is a README.',
    refetch: jest.fn(),
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

    it('reports an interaction when the Add README button is clicked', () => {
      setReadmeResult({ status: 'missing', markdownContent: undefined });

      render(<FolderReadmePanel folderUID="test-folder" />);
      fireEvent.click(screen.getByRole('link', { name: /Add README/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_create_clicked', {
        repositoryType: 'github',
      });
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

    it('calls refetch when the retry button is clicked', () => {
      const refetch = jest.fn();
      setReadmeResult({ status: 'error', markdownContent: undefined, refetch });

      render(<FolderReadmePanel folderUID="test-folder" />);
      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

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
    config.featureToggles = { provisioningReadmes: false };
    setReadmeResult();

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not invoke useFolderReadme when the feature toggle is off', () => {
    config.featureToggles = { provisioningReadmes: false };
    setReadmeResult();
    render(<FolderReadmePanel folderUID="test-folder" />);
    expect(mockUseFolderReadme).not.toHaveBeenCalled();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setReadmeResult({ repository: undefined });

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the repository view is loading', () => {
    setReadmeResult({ status: 'loading' });

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a spinner while the README itself is loading', () => {
    // When status is 'loading', the panel returns null — the layout shows the
    // dashboards list as-is while loading; the panel appears once data arrives.
    setReadmeResult({ status: 'loading', markdownContent: undefined });

    const { container } = render(<FolderReadmePanel folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an empty README without the parse-error message', () => {
    setReadmeResult({ markdownContent: '' });

    render(<FolderReadmePanel folderUID="test-folder" />);
    expect(screen.queryByText(/Unable to display README content/i)).not.toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit README/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add README/i })).not.toBeInTheDocument();
  });
});
