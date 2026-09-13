import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import type { ManagerKind } from 'app/features/apiserver/types';

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
    rootFolderItem?: { item: { uid: string; title: string } };
    folderFilter?: (folder: { uid: string; managedBy?: ManagerKind; managerId?: string }) => boolean;
  }) => (
    <div data-testid="folder-picker">
      <div data-testid="root-folder-uid">{props.rootFolderUID || 'undefined'}</div>
      <div data-testid="exclude-uids">{JSON.stringify(props.excludeUIDs || [])}</div>
      <div data-testid="root-item-uid">{props.rootFolderItem?.item.uid ?? 'undefined'}</div>
      <div data-testid="root-item-title">{props.rootFolderItem?.item.title ?? 'undefined'}</div>
      <div data-testid="filtered-uids">
        {JSON.stringify(
          [
            { uid: 'active-repo-folder', managedBy: 'repo' as ManagerKind, managerId: 'folderless-repo' },
            { uid: 'other-repo-folder', managedBy: 'repo' as ManagerKind, managerId: 'other-repo' },
            { uid: 'unmanaged-folder' },
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
  repositoryTarget = undefined,
  excludeUIDs = undefined,
}: {
  repoName?: string;
  repositoryTarget?: 'folder' | 'folderless' | 'instance';
  isNonProvisionedFolder?: boolean;
  excludeUIDs?: string[];
}) => {
  render(
    <ProvisioningAwareFolderPicker
      repositoryName={repoName}
      repositoryTarget={repositoryTarget}
      onChange={jest.fn()}
      excludeUIDs={excludeUIDs}
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

    it('should set root folder for repository context', () => {
      setup({ repoName: 'repo1' });

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('repo1');
      expect(screen.getByTestId('root-item-uid')).toHaveTextContent('repo1');
      expect(screen.getByTestId('filtered-uids')).toHaveTextContent(
        '["active-repo-folder","other-repo-folder","unmanaged-folder"]'
      );
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

      setup({ repoName: 'folderless-repo', repositoryTarget: 'folderless' });

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('general');
      expect(screen.getByTestId('root-item-uid')).toBeEmptyDOMElement();
      expect(screen.getByTestId('root-item-title')).toHaveTextContent('Folderless Repository');
      expect(screen.getByTestId('filtered-uids')).toHaveTextContent('["active-repo-folder"]');
    });

    it('should use the provided folderless target before settings have loaded', () => {
      mockUseGetFrontendSettingsQuery.mockReturnValue({ data: undefined, isLoading: true });

      setup({ repoName: 'folderless-repo', repositoryTarget: 'folderless' });

      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('general');
      expect(screen.getByTestId('filtered-uids')).toHaveTextContent('["active-repo-folder"]');
    });

    it('should exclude provisioned folders for non-provisioned context', () => {
      setup({ repoName: undefined });
      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('["repo1","repo2","repo3"]');
    });

    it('should merge excludeUIDs', () => {
      setup({ repoName: undefined, excludeUIDs: ['custom1'] });

      const excludeUIDs = JSON.parse(screen.getByTestId('exclude-uids').textContent || '[]');
      expect(excludeUIDs).toEqual(['repo1', 'repo2', 'repo3', 'custom1']);
    });
  });

  describe('Feature Toggle Disabled', () => {
    beforeEach(() => {
      mockUseIsProvisionedInstance.mockReturnValue(false);
      config.provisioningEnabled = false;
    });

    it('should not apply restrictions', () => {
      setup({ isNonProvisionedFolder: true });
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
      setup({ isNonProvisionedFolder: true });
      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('[]');
    });
  });
});
