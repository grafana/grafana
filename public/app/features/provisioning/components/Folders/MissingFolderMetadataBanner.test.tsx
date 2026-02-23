import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: {
      ...actual.config,
      featureToggles: { provisioningFolderMetadata: true },
    },
  };
});

jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseGetRepositoryFilesWithPathQuery = jest.mocked(useGetRepositoryFilesWithPathQuery);

const provisionedFolder = {
  metadata: {
    annotations: {
      [AnnoKeyManagerKind]: ManagerKind.Repo,
      [AnnoKeySourcePath]: 'folders/my-folder',
    },
  },
};

const defaultRepoView = {
  repository: { name: 'my-repo', target: 'folder' as const, title: 'Repo', type: 'github' as const },
  folder: provisionedFolder,
  isLoading: false,
  isInstanceManaged: false,
  isReadOnlyRepo: false,
};

function setup(
  repoViewOverrides: Partial<ReturnType<typeof useGetResourceRepositoryView>> = {},
  fileQueryOverrides: Partial<ReturnType<typeof useGetRepositoryFilesWithPathQuery>> = {},
  folderUID = 'test-folder'
) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    ...defaultRepoView,
    ...repoViewOverrides,
  } as ReturnType<typeof useGetResourceRepositoryView>);

  mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    refetch: jest.fn(),
    ...fileQueryOverrides,
  } as ReturnType<typeof useGetRepositoryFilesWithPathQuery>);

  return render(<MissingFolderMetadataBanner folderUID={folderUID} />);
}

describe('MissingFolderMetadataBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config.featureToggles as Record<string, boolean>).provisioningFolderMetadata = true;
  });

  describe('when banner should not render', () => {
    it('returns null when feature flag is off', () => {
      (config.featureToggles as Record<string, boolean>).provisioningFolderMetadata = false;
      setup();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when folderUID is undefined', () => {
      setup({}, {}, undefined);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when folder is not provisioned', () => {
      setup({
        folder: { metadata: { annotations: {} }, spec: { title: 'Test' } },
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when repository is not available', () => {
      setup({ repository: undefined });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null for local repositories', () => {
      setup({
        repository: { name: 'my-repo', target: 'folder' as const, title: 'Repo', type: 'local' as const },
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when file query is loading', () => {
      setup({}, { isLoading: true });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns null when _folder.json exists', () => {
      setup({}, { data: { path: 'folders/my-folder/_folder.json' }, error: undefined });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when banner should render', () => {
    it('shows warning banner when _folder.json is missing (404)', () => {
      const error = { status: 404, data: { message: 'not found' } };

      setup({}, { error, isLoading: false });

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
        },
      });

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: '_folder.json',
      });
    });

    it('uses skipToken when folder is not provisioned', () => {
      setup({ folder: { metadata: { annotations: {} }, spec: { title: 'Test' } } });

      // When skipToken is used, RTK Query receives the symbol
      const call = mockUseGetRepositoryFilesWithPathQuery.mock.calls[0]?.[0];
      expect(typeof call).toBe('symbol');
    });
  });
});
