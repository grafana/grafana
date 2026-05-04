import { fireEvent, render, screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';

import { useFolderReadme } from '../../hooks/useFolderReadme';

import { FolderReadmeEditAction } from './FolderReadmeEditAction';

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

describe('FolderReadmeEditAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders an Edit README button targeting the GitHub edit URL', () => {
    setReadmeResult();

    render(<FolderReadmeEditAction folderUID="test-folder" />);

    const link = screen.getByRole('link', { name: /Edit README/i });
    expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/edit/main/README.md');
  });

  it('prefixes the edit URL with the repository path when configured', () => {
    setReadmeResult({ repository: { ...mockRepository, path: 'ops/resources' } });

    render(<FolderReadmeEditAction folderUID="test-folder" />);

    expect(screen.getByRole('link', { name: /Edit README/i })).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/edit/main/ops/resources/README.md'
    );
  });

  it('reports an interaction when clicked', () => {
    setReadmeResult();

    render(<FolderReadmeEditAction folderUID="test-folder" />);
    fireEvent.click(screen.getByRole('link', { name: /Edit README/i }));

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_edit_clicked', {
      repositoryType: 'github',
    });
  });

  it('renders nothing when no README has loaded', () => {
    setReadmeResult({ fileData: undefined });

    const { container } = render(<FolderReadmeEditAction folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setReadmeResult({ repository: undefined });

    const { container } = render(<FolderReadmeEditAction folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for repository types without a known edit URL', () => {
    setReadmeResult({ repository: { ...mockRepository, type: 'git', url: 'https://example.com/repo.git' } });

    const { container } = render(<FolderReadmeEditAction folderUID="test-folder" />);
    expect(container).toBeEmptyDOMElement();
  });
});
