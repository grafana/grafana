import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

import { ProvisioningAwareFolderPicker } from './ProvisioningAwareFolderPicker';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: jest.fn(),
}));

jest.mock('../../hooks/useIsProvisionedInstance', () => ({
  useIsProvisionedInstance: jest.fn(),
}));

jest.mock('app/core/components/Select/FolderPicker', () => ({
  FolderPicker: (props: {
    rootFolderUID?: string;
    excludeUIDs?: string[];
    rootFolderItem?: { item: { uid: string; title: string; managerId?: string } };
    folderFilter?: (folder: { uid: string; managedBy?: ManagerKind; managerId?: string }) => boolean;
  }) => (
    <div data-testid="folder-picker">
      <div data-testid="root-folder-uid">{props.rootFolderUID || 'undefined'}</div>
      <div data-testid="exclude-uids">{JSON.stringify(props.excludeUIDs || [])}</div>
      <div data-testid="root-item-uid">{props.rootFolderItem?.item.uid ?? 'undefined'}</div>
      <div data-testid="root-item-title">{props.rootFolderItem?.item.title ?? 'undefined'}</div>
      <div data-testid="root-item-manager-id">{props.rootFolderItem?.item.managerId ?? 'undefined'}</div>
      <div data-testid="filtered-uids">
        {JSON.stringify(
          [
            { uid: 'repo1-folder', managedBy: ManagerKind.Repo, managerId: 'repo1' },
            { uid: 'active-repo-folder', managedBy: ManagerKind.Repo, managerId: 'folderless-repo' },
            { uid: 'other-repo-folder', managedBy: ManagerKind.Repo, managerId: 'other-repo' },
            { uid: 'unmanaged-folder' },
            { uid: 'legacy-api-repo-folder', managedBy: ManagerKind.Repo },
          ]
            .filter((folder) => props.folderFilter?.(folder) ?? true)
            .map((folder) => folder.uid)
        )}
      </div>
    </div>
  ),
}));

const mockUseGetFrontendSettingsQuery = useGetFrontendSettingsQuery as Partial<
  ReturnType<typeof useGetFrontendSettingsQuery>
>;
const mockUseIsProvisionedInstance = useIsProvisionedInstance as jest.MockedFunction<typeof useIsProvisionedInstance>;

const setup = ({
  repoName = undefined,
  excludeUIDs = undefined,
  showAllFolders = false,
}: {
  repoName?: string;
  excludeUIDs?: string[];
  showAllFolders?: boolean;
}) => {
  render(
    <ProvisioningAwareFolderPicker
      repositoryName={repoName}
      onChange={jest.fn()}
      excludeUIDs={excludeUIDs}
      showAllFolders={showAllFolders}
    />
  );
};

describe('ProvisioningAwareFolderPicker', () => {
  const mockSettingsData = {
    items: [
      { name: 'repo1', title: 'Repository 1', target: 'folder', type: 'github', workflows: [] },
      { name: 'repo2', title: 'Repository 2', target: 'folder', type: 'github', workflows: [] },
      { name: 'repo3', title: 'Repository 3', target: 'folder', type: 'github', workflows: [] },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGetFrontendSettingsQuery.mockReturnValue({
      data: mockSettingsData,
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    });

    config.provisioningEnabled = true;
  });

  describe('Provisioned Instance', () => {
    beforeEach(() => {
      mockUseIsProvisionedInstance.mockReturnValue(true);
    });

    it('should not restrict folders', () => {
      setup({});

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('undefined');
      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('[]');
    });
  });

  describe('Non-Provisioned Instance', () => {
    beforeEach(() => {
      mockUseIsProvisionedInstance.mockReturnValue(false);
    });

    it('should scope a managed-folder repository to its folder and only show folders it owns', () => {
      setup({ repoName: 'repo1' });

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('repo1');
      expect(screen.getByTestId('root-item-uid')).toHaveTextContent('repo1');
      expect(screen.getByTestId('root-item-manager-id')).toHaveTextContent('repo1');
      expect(screen.getByTestId('filtered-uids')).toHaveTextContent('["repo1-folder","legacy-api-repo-folder"]');
    });

    it('should browse folderless repositories from root and only show folders owned by that repository', () => {
      mockUseGetFrontendSettingsQuery.mockReturnValue({
        data: {
          items: [
            {
              name: 'folderless-repo',
              title: 'Folderless Repository',
              target: 'folderless',
              type: 'github',
              workflows: ['write'],
            },
          ],
        },
      });

      setup({ repoName: 'folderless-repo' });

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('undefined');
      expect(screen.getByTestId('root-item-uid')).toBeEmptyDOMElement();
      expect(screen.getByTestId('root-item-title')).toHaveTextContent('Folderless Repository');
      expect(screen.getByTestId('root-item-manager-id')).toHaveTextContent('folderless-repo');
      expect(screen.getByTestId('filtered-uids')).toHaveTextContent('["active-repo-folder"]');
    });

    it('should show only local folders for local resources', () => {
      setup({ repoName: undefined });

      expect(screen.getByTestId('filtered-uids')).toHaveTextContent('["unmanaged-folder"]');
    });

    it('should pass caller exclusions through for local resources', () => {
      setup({ repoName: undefined, excludeUIDs: ['custom1'] });

      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('["custom1"]');
    });

    it('should preserve caller exclusions when all folders are shown', () => {
      setup({ showAllFolders: true, excludeUIDs: ['custom1'] });

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('undefined');
      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('["custom1"]');
    });

    it('should keep an unknown repository scoped to its name', () => {
      setup({ repoName: 'deleted-repo' });

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('deleted-repo');
      expect(screen.getByTestId('filtered-uids')).toHaveTextContent(
        '["repo1-folder","active-repo-folder","other-repo-folder","unmanaged-folder","legacy-api-repo-folder"]'
      );
    });
  });

  describe('Feature Toggle Disabled', () => {
    beforeEach(() => {
      mockUseIsProvisionedInstance.mockReturnValue(false);
      config.provisioningEnabled = false;
    });

    it('should not apply restrictions', () => {
      setup({});
      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('undefined');
      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('[]');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockUseIsProvisionedInstance.mockReturnValue(false);
    });

    it('should handle missing settings data', () => {
      mockUseGetFrontendSettingsQuery.mockReturnValue({ data: undefined });
      setup({});
      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('[]');
    });
  });
});
