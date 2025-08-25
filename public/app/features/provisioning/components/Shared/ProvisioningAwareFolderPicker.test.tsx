import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useIsProvisionedInstance } from '../../hooks/useIsProvisionedInstance';

import { ProvisioningAwareFolderPicker } from './ProvisioningAwareFolderPicker';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: jest.fn(),
}));

jest.mock('../../hooks/useIsProvisionedInstance', () => ({
  useIsProvisionedInstance: jest.fn(),
}));

jest.mock('app/core/components/Select/FolderPicker', () => ({
  FolderPicker: (props: { rootFolderUID?: string; excludeUIDs?: string[] }) => (
    <div data-testid="folder-picker">
      <div data-testid="root-folder-uid">{props.rootFolderUID || 'undefined'}</div>
      <div data-testid="exclude-uids">{JSON.stringify(props.excludeUIDs || [])}</div>
    </div>
  ),
}));

const mockUseGetFrontendSettingsQuery = useGetFrontendSettingsQuery as Partial<
  ReturnType<typeof useGetFrontendSettingsQuery>
>;
const mockUseIsProvisionedInstance = useIsProvisionedInstance as jest.MockedFunction<typeof useIsProvisionedInstance>;

const setup = ({
  repoName = 'test-repo',
  isNonProvisionedFolder = false,
  excludeUIDs = undefined,
}: {
  repoName?: string;
  isNonProvisionedFolder?: boolean;
  excludeUIDs?: string[];
}) => {
  render(
    <ProvisioningAwareFolderPicker
      repositoryName={repoName}
      isNonProvisionedFolder={isNonProvisionedFolder}
      onChange={jest.fn()}
      excludeUIDs={excludeUIDs}
    />
  );
};

describe('ProvisioningAwareFolderPicker', () => {
  const mockSettingsData = {
    items: [{ name: 'repo1' }, { name: 'repo2' }, { name: 'repo3' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGetFrontendSettingsQuery.mockReturnValue({
      data: mockSettingsData,
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    });

    config.featureToggles = { provisioning: true };
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
      setup({ repoName: 'my-repo' });
      expect(screen.getByTestId('root-folder-uid')).toHaveTextContent('my-repo');
    });

    it('should exclude provisioned folders for non-provisioned context', () => {
      setup({ isNonProvisionedFolder: true });
      expect(screen.getByTestId('exclude-uids')).toHaveTextContent('["repo1","repo2","repo3"]');
    });

    it('should merge excludeUIDs', () => {
      setup({ isNonProvisionedFolder: true, excludeUIDs: ['custom1'] });

      const excludeUIDs = JSON.parse(screen.getByTestId('exclude-uids').textContent || '[]');
      expect(excludeUIDs).toEqual(['repo1', 'repo2', 'repo3', 'custom1']);
    });
  });

  describe('Feature Toggle Disabled', () => {
    beforeEach(() => {
      mockUseIsProvisionedInstance.mockReturnValue(false);
      config.featureToggles.provisioning = false;
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
