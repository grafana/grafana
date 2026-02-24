import { render, screen } from '@testing-library/react';
import { testWithFeatureToggles } from 'test/test-utils';

import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
}));

const mockUseGetRepositoryFilesWithPathQuery = jest.mocked(useGetRepositoryFilesWithPathQuery);

const defaultRepository: RepositoryView = {
  name: 'my-repo',
  target: 'folder',
  title: 'Repo',
  type: 'github',
  workflows: ['branch'],
};

const defaultFolder = {
  metadata: {
    annotations: {
      [AnnoKeyManagerKind]: ManagerKind.Repo,
      [AnnoKeySourcePath]: 'folders/my-folder',
    },
  },
  spec: { title: 'My Folder' },
} as Folder;

function setup({
  repository = defaultRepository,
  folder = defaultFolder,
  fileQueryOverrides = {},
}: {
  repository?: RepositoryView;
  folder?: Folder;
  fileQueryOverrides?: Partial<ReturnType<typeof useGetRepositoryFilesWithPathQuery>>;
} = {}) {
  mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    refetch: jest.fn(),
    ...fileQueryOverrides,
  } as ReturnType<typeof useGetRepositoryFilesWithPathQuery>);

  return render(<MissingFolderMetadataBanner repository={repository} folder={folder} />);
}

describe('MissingFolderMetadataBanner', () => {
  testWithFeatureToggles({ enable: ['provisioningFolderMetadata'] });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when feature flag is off', () => {
    testWithFeatureToggles({ disable: ['provisioningFolderMetadata'] });

    it('returns null', () => {
      setup();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when banner should not render', () => {
    it('returns null when repository is undefined', () => {
      setup({ repository: undefined });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when folder is undefined', () => {
      setup({ folder: undefined });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when folder is not provisioned', () => {
      setup({
        folder: { metadata: { annotations: {} }, spec: { title: 'Test' } } as Folder,
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when file query is loading', () => {
      setup({ fileQueryOverrides: { isLoading: true } });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when _folder.json exists', () => {
      setup({
        fileQueryOverrides: { data: { path: 'folders/my-folder/_folder.json' }, error: undefined },
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when banner should render', () => {
    it('shows warning banner when _folder.json is missing (404)', () => {
      const error = { status: 404, data: { message: 'not found' } };

      setup({ fileQueryOverrides: { error, isLoading: false } });

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('This folder is missing stable ID metadata.')).toBeInTheDocument();
      expect(
        screen.getByText('Permissions may not persist if the folder is moved or renamed in Git.')
      ).toBeInTheDocument();
    });
  });

  describe('API call arguments', () => {
    it('queries the correct _folder.json path for nested folders', () => {
      setup();

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: 'folders/my-folder/_folder.json',
      });
    });

    it('queries _folder.json at repo root for root provisioned folders', () => {
      setup({
        folder: {
          metadata: {
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
            },
          },
          spec: { title: 'Root Folder' },
        } as Folder,
      });

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: '_folder.json',
      });
    });

    it('normalizes trailing slash in source path', () => {
      setup({
        folder: {
          metadata: {
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
              [AnnoKeySourcePath]: 'folders/my-folder/',
            },
          },
          spec: { title: 'Trailing Slash' },
        } as Folder,
      });

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: 'folders/my-folder/_folder.json',
      });
    });
  });
});
