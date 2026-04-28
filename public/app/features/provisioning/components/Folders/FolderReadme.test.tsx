import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config, reportInteraction } from '@grafana/runtime';
import { type RepositoryView, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

import { FolderReadmeContent } from './FolderReadme';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetRepositoryFilesWithPathQuery: jest.fn(),
}));

jest.mock('../../hooks/useGetResourceRepositoryView');

const mockReportInteraction = reportInteraction as jest.MockedFunction<typeof reportInteraction>;

const mockUseGetRepositoryFilesWithPathQuery = useGetRepositoryFilesWithPathQuery as jest.MockedFunction<
  typeof useGetRepositoryFilesWithPathQuery
>;

const mockUseGetResourceRepositoryView = useGetResourceRepositoryView as jest.MockedFunction<
  typeof useGetResourceRepositoryView
>;

const mockRepository: RepositoryView = {
  name: 'test-repo',
  target: 'folder',
  title: 'Test Repository',
  type: 'github',
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
  spec: {
    title: 'Test Folder',
  },
  status: {},
} as never;

function emptyQueryResult(overrides: Partial<ReturnType<typeof useGetRepositoryFilesWithPathQuery>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useGetRepositoryFilesWithPathQuery>;
}

describe('FolderReadmeContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { provisioningReadmes: true };
  });

  afterEach(() => {
    config.featureToggles = {};
  });

  describe('when folder is not provisioned', () => {
    it('shows the not-provisioned message', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: undefined,
        folder: undefined,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult());

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/not managed by a Git repository/i)).toBeInTheDocument();
    });
  });

  describe('when loading', () => {
    it('shows a spinner while loading repository info', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: true,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'loading' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult());

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });

    it('shows a spinner while fetching the README', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult({ isLoading: true }));

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });
  });

  describe('when README fetch fails', () => {
    it('shows the not-found message on error', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(
        emptyQueryResult({ isError: true, error: { status: 404, data: 'Not found' } })
      );

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/No README.md file found/i)).toBeInTheDocument();
    });

    it('shows the not-found message when the response has no data', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult());

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/No README.md file found/i)).toBeInTheDocument();
    });

    it('renders a Create README on GitHub call-to-action that targets the new-file URL with a prefilled template', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult());

      render(<FolderReadmeContent folderUID="test-folder" />);

      const createLink = screen.getByRole('link', { name: /Create README on GitHub/i });
      const href = createLink.getAttribute('href') ?? '';
      expect(href).toMatch(
        /^https:\/\/github\.com\/owner\/repo\/new\/main\?filename=dashboards%2Fteam-a%2FREADME\.md/
      );
      expect(href).toContain('value=');
      const value = decodeURIComponent(new URL(href).searchParams.get('value') ?? '');
      expect(value).toContain('# Test Folder');
    });

    it('reports an interaction when the create-on-host button is clicked', async () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult());

      render(<FolderReadmeContent folderUID="test-folder" />);
      await userEvent.click(screen.getByRole('link', { name: /Create README on GitHub/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_create_clicked', {
        repositoryType: 'github',
      });
    });
  });

  describe('when README is successfully fetched', () => {
    it('reports an interaction when the edit-on-host button is clicked', async () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(
        emptyQueryResult({
          data: {
            resource: { file: { content: '# hello' } },
          } as never,
        })
      );

      render(<FolderReadmeContent folderUID="test-folder" />);
      await userEvent.click(screen.getByRole('link', { name: /Edit on GitHub/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_edit_clicked', {
        repositoryType: 'github',
      });
    });

    it('renders markdown content and an Edit on GitHub button', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(
        emptyQueryResult({
          data: {
            resource: {
              file: { content: '# Hello World\n\nThis is a test README.' },
            },
          } as never,
        })
      );

      render(<FolderReadmeContent folderUID="test-folder" />);

      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText('This is a test README.')).toBeInTheDocument();

      const editLink = screen.getByRole('link', { name: /Edit on GitHub/i });
      expect(editLink).toHaveAttribute(
        'href',
        'https://github.com/owner/repo/edit/main/dashboards/team-a/README.md'
      );
    });

    it('handles a string file body directly', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(
        emptyQueryResult({
          data: {
            resource: { file: '# Direct String Content' },
          } as never,
        })
      );

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText('Direct String Content')).toBeInTheDocument();
    });

    it('shows a parse error when the file payload is unrecognised', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(
        emptyQueryResult({
          data: {
            resource: { file: { someUnexpectedFormat: true } },
          } as never,
        })
      );

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/Unable to display README content/i)).toBeInTheDocument();
    });
  });

  describe('README path construction', () => {
    it('uses the source path from folder annotations', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult());

      render(<FolderReadmeContent folderUID="test-folder" />);

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'test-repo',
        path: 'dashboards/team-a/README.md',
      });
    });

    it('falls back to the root README.md when no source path is set', () => {
      const folderWithoutPath = {
        metadata: { name: 'test-folder', annotations: {} },
        spec: { title: 'Test Folder' },
        status: {},
      };

      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: folderWithoutPath as never,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        status: 'ready' as never,
      });
      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(emptyQueryResult());

      render(<FolderReadmeContent folderUID="test-folder" />);

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'test-repo',
        path: 'README.md',
      });
    });
  });
});
