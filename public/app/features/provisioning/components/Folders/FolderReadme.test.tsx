import { render, screen } from '@testing-library/react';

import { useGetRepositoryFilesWithPathQuery, RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

import { FolderReadmeContent } from './FolderReadme';

// Mock dependencies
jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
}));

jest.mock('../../hooks/useGetResourceRepositoryView');

const mockUseGetRepositoryFilesWithPathQuery = useGetRepositoryFilesWithPathQuery as jest.MockedFunction<
  typeof useGetRepositoryFilesWithPathQuery
>;

const mockUseGetResourceRepositoryView = useGetResourceRepositoryView as jest.MockedFunction<
  typeof useGetResourceRepositoryView
>;

const mockRepository: RepositoryView = {
  name: 'test-repo',
  target: 'folder' as const,
  title: 'Test Repository',
  type: 'git' as const,
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
};

describe('FolderReadmeContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when folder is not provisioned', () => {
    it('should show not provisioned message when repository is undefined', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: undefined,
        folder: undefined,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/not managed by a Git repository/i)).toBeInTheDocument();
    });
  });

  describe('when loading', () => {
    it('should show loading spinner while loading repository info', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: true,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });

    it('should show loading spinner while fetching README', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });
  });

  describe('when README fetch fails', () => {
    it('should show not found message on error', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { status: 404, data: 'Not found' },
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/No README.md file found/i)).toBeInTheDocument();
    });

    it('should show not found message when file data is empty', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/No README.md file found/i)).toBeInTheDocument();
    });
  });

  describe('when README is successfully fetched', () => {
    it('should render markdown content', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: {
          resource: {
            file: {
              content: '# Hello World\n\nThis is a test README.',
            },
          },
        },
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);

      // The markdown should be rendered as HTML
      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText('This is a test README.')).toBeInTheDocument();
    });

    it('should handle string content directly', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: {
          resource: {
            file: '# Direct String Content',
          },
        },
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText('Direct String Content')).toBeInTheDocument();
    });

    it('should show parse error when file content cannot be extracted', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: {
          resource: {
            file: { someUnexpectedFormat: true },
          },
        },
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);
      expect(screen.getByText(/Unable to display README content/i)).toBeInTheDocument();
    });
  });

  describe('README path construction', () => {
    it('should use source path from folder annotations', () => {
      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: mockFolder,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);

      // Verify the query was called with the correct path
      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'test-repo',
        path: 'dashboards/team-a/README.md',
      });
    });

    it('should use root README.md when no source path is set', () => {
      const folderWithoutPath = {
        metadata: {
          name: 'test-folder',
          annotations: {},
        },
        spec: { title: 'Test Folder' },
        status: {},
      };

      mockUseGetResourceRepositoryView.mockReturnValue({
        repository: mockRepository,
        folder: folderWithoutPath,
        isLoading: false,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
      });

      mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<FolderReadmeContent folderUID="test-folder" />);

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'test-repo',
        path: 'README.md',
      });
    });
  });
});
