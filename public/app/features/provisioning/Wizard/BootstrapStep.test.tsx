import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import { useGetRepositoryFilesQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { BootstrapStep, Props } from './BootstrapStep';
import { StepStatusProvider } from './StepStatusContext';
import { useModeOptions } from './hooks/useModeOptions';
import { WizardFormData } from './types';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesQuery: jest.fn(),
  useGetResourceStatsQuery: jest.fn(),
}));

jest.mock('./hooks/useModeOptions', () => ({
  useModeOptions: jest.fn(),
}));

jest.mock('./hooks/useResourceStats', () => ({
  useResourceStats: jest.fn(),
}));

// Wrapper component to provide form context
function FormWrapper({ children, defaultValues }: { children: ReactNode; defaultValues?: Partial<WizardFormData> }) {
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: {
        type: 'github',
        url: 'https://github.com/test/repo',
        title: '',
        sync: {
          target: 'instance',
          enabled: true,
        },
        branch: 'main',
        path: '',
        readOnly: false,
        prWorkflow: false,
        ...defaultValues?.repository,
      },
      ...defaultValues,
    },
  });

  return (
    <FormProvider {...methods}>
      <StepStatusProvider>{children}</StepStatusProvider>
    </FormProvider>
  );
}

function setup(props: Partial<Props> = {}, formDefaultValues?: Partial<WizardFormData>) {
  const user = userEvent.setup();

  const defaultProps: Props = {
    repoName: 'test-repo',
    settingsData: undefined,
    ...props,
  };

  const utils = render(
    <FormWrapper defaultValues={formDefaultValues}>
      <BootstrapStep {...defaultProps} />
    </FormWrapper>
  );

  return {
    user,
    props: defaultProps,
    ...utils,
  };
}

describe('BootstrapStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetRepositoryFilesQuery as jest.Mock).mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });

    (useGetResourceStatsQuery as jest.Mock).mockReturnValue({
      data: { instance: [] },
      isLoading: false,
    });

    const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
    mockUseResourceStats.mockReturnValue({
      fileCount: 0,
      resourceCount: 0,
      resourceCountString: 'Empty',
      fileCountString: 'Empty',
      isLoading: false,
      requiresMigration: false,
      shouldSkipSync: true,
    });

    (useModeOptions as jest.Mock).mockReturnValue([
      {
        target: 'instance',
        label: 'Sync all resources with external storage',
        description: 'Resources will be synced with external storage',
        subtitle: 'Use this option if you want to sync your entire instance',
      },
      {
        target: 'folder',
        label: 'Sync external storage to a new Grafana folder',
        description: 'A new Grafana folder will be created',
        subtitle: 'Use this option to sync into a new folder',
      },
    ]);
  });

  describe('rendering', () => {
    it('should render loading state when data is loading', () => {
      (useGetRepositoryFilesQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 0,
        resourceCount: 0,
        resourceCountString: 'Empty',
        fileCountString: 'Empty',
        isLoading: true,
        requiresMigration: false,
        shouldSkipSync: true,
      });

      setup();

      expect(screen.getByText('Loading resource information...')).toBeInTheDocument();
    });

    it('should render correct info for GitHub repository type', async () => {
      setup();
      expect(screen.getAllByText('External storage')).toHaveLength(2);
      expect(screen.getAllByText('Empty')).toHaveLength(3); // Three elements should have the role "Empty" (2 external + 1 unmanaged)
    });

    it('should render correct info for local file repository type', async () => {
      (useGetRepositoryFilesQuery as jest.Mock).mockReturnValue({
        data: {
          items: [
            { path: 'dashboard1.json' },
            { path: 'dashboard2.yaml' },
            { path: 'README.md' }, // Should not be counted
          ],
        },
        isLoading: false,
      });

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 2,
        resourceCount: 0,
        resourceCountString: 'Empty',
        fileCountString: '2 files',
        isLoading: false,
        requiresMigration: false,
        shouldSkipSync: false,
      });

      setup();

      expect(await screen.getAllByText('2 files')).toHaveLength(2);
    });

    it('should display resource counts when resources exist', async () => {
      (useGetResourceStatsQuery as jest.Mock).mockReturnValue({
        data: {
          instance: [
            { group: 'dashboard.grafana.app', count: 5 },
            { group: 'folders', count: 2 },
          ],
        },
        isLoading: false,
      });

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 0,
        resourceCount: 7,
        resourceCountString: '7 resources',
        fileCountString: 'Empty',
        isLoading: false,
        requiresMigration: true,
        shouldSkipSync: false,
      });

      setup();

      expect(await screen.findByText('7 resources')).toBeInTheDocument();
    });
  });

  describe('hook integration', () => {
    it('should use useResourceStats hook correctly', async () => {
      setup();

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      expect(mockUseResourceStats).toHaveBeenCalledWith('test-repo', undefined);
    });

    it('should use useResourceStats hook with legacy storage flag', async () => {
      setup({
        settingsData: {
          legacyStorage: true,
          items: [],
          availableRepositoryTypes: [],
        },
      });

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      expect(mockUseResourceStats).toHaveBeenCalledWith('test-repo', true);
    });
  });

  describe('sync target options', () => {
    it('should display both instance and folder options by default', async () => {
      setup();

      expect(await screen.findByText('Sync all resources with external storage')).toBeInTheDocument();
      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
    });

    it('should only display instance option when legacy storage exists', async () => {
      (useModeOptions as jest.Mock).mockReturnValue([
        {
          target: 'instance',
          label: 'Sync all resources with external storage',
          description: 'Resources will be synced with external storage',
          subtitle: 'Use this option if you want to sync your entire instance',
        },
      ]);

      setup({
        settingsData: {
          legacyStorage: true,
          items: [],
          availableRepositoryTypes: [],
        },
      });

      expect(await screen.findByText('Sync all resources with external storage')).toBeInTheDocument();
      expect(screen.queryByText('Sync external storage to a new Grafana folder')).not.toBeInTheDocument();
    });

    it('should allow selecting different sync targets', async () => {
      const { user } = setup();

      const folderOption = await screen.findByText('Sync external storage to a new Grafana folder');
      await user.click(folderOption);

      // Check that the folder option is now selected by looking for the title field
      expect(await screen.findByRole('textbox', { name: /display name/i })).toBeInTheDocument();
    });
  });

  describe('title field visibility', () => {
    it('should show title field only for folder sync target', async () => {
      const { user } = setup();

      // Initially should not show title field (default is instance)
      expect(screen.queryByRole('textbox', { name: /display name/i })).not.toBeInTheDocument();

      const folderOption = await screen.findByText('Sync external storage to a new Grafana folder');
      await user.click(folderOption);

      expect(await screen.findByRole('textbox', { name: /display name/i })).toBeInTheDocument();
    });
  });
});
