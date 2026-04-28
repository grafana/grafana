import { fireEvent, render, screen } from '@testing-library/react';

import { config, reportInteraction } from '@grafana/runtime';

import { useFolderReadme } from '../../hooks/useFolderReadme';

import { FolderReadmeHint } from './FolderReadmeHint';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    reportInteraction: jest.fn(),
    config: {
      ...actual.config,
      featureToggles: {},
    },
  };
});

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

function setReadmeResult(overrides: Partial<ReturnType<typeof useFolderReadme>> = {}) {
  mockUseFolderReadme.mockReturnValue({
    repository: mockRepository,
    folder: undefined,
    readmePath: 'README.md',
    isRepoLoading: false,
    isFileLoading: false,
    isError: false,
    fileData: { resource: { file: { content: '# hello' } } } as never,
    ...overrides,
  });
}

describe('FolderReadmeHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { provisioningReadmes: true };
  });

  it('renders the info banner with a link to the README tab when a README exists', () => {
    setReadmeResult();

    render(<FolderReadmeHint folderUID="test-folder" folderUrl="/dashboards/f/test-folder" />);

    expect(screen.getByText(/New to this folder/i)).toBeInTheDocument();
    expect(screen.getByText(/The README explains how this folder is organized/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /See details/i });
    expect(link).toHaveAttribute('href', '/dashboards/f/test-folder/readme');
  });

  it('reports an interaction when the link is clicked', () => {
    setReadmeResult();

    render(<FolderReadmeHint folderUID="test-folder" folderUrl="/dashboards/f/test-folder" />);
    fireEvent.click(screen.getByRole('link', { name: /See details/i }));

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_hint_clicked', {
      repositoryType: 'github',
    });
  });

  it('renders nothing when the feature toggle is off', () => {
    config.featureToggles = { provisioningReadmes: false };
    setReadmeResult();

    const { container } = render(<FolderReadmeHint folderUID="test-folder" folderUrl="/dashboards/f/test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while still loading', () => {
    setReadmeResult({ isFileLoading: true });

    const { container } = render(<FolderReadmeHint folderUID="test-folder" folderUrl="/dashboards/f/test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the README fetch fails', () => {
    setReadmeResult({ isError: true, fileData: undefined });

    const { container } = render(<FolderReadmeHint folderUID="test-folder" folderUrl="/dashboards/f/test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no README is found', () => {
    setReadmeResult({ fileData: undefined });

    const { container } = render(<FolderReadmeHint folderUID="test-folder" folderUrl="/dashboards/f/test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setReadmeResult({ repository: undefined });

    const { container } = render(<FolderReadmeHint folderUID="test-folder" folderUrl="/dashboards/f/test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });
});
