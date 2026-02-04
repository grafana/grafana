import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import { useGetRepositoryFilesQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isFreeTierLicense } from '../utils/isFreeTierLicense';

import { BootstrapStep, Props } from './BootstrapStep';
import { StepStatusProvider } from './StepStatusContext';
import { useModeOptions } from './hooks/useModeOptions';
import { useRepositoryStatus } from './hooks/useRepositoryStatus';
import { useResourceStats } from './hooks/useResourceStats';
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

jest.mock('./hooks/useRepositoryStatus', () => ({
  useRepositoryStatus: jest.fn(),
}));

jest.mock('../utils/isFreeTierLicense', () => ({
  isFreeTierLicense: jest.fn(),
}));

type WizardFormDefaults = Omit<Partial<WizardFormData>, 'repository'> & {
  repository?: Partial<WizardFormData['repository']>;
};

// Wrapper component to provide form context
function FormWrapper({ children, defaultValues }: { children: ReactNode; defaultValues?: WizardFormDefaults }) {
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: {
        type: 'github',
        url: 'https://github.com/test/repo',
        title: '',
        sync: {
          target: 'folder',
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

function setup(props: Partial<Props> = {}, formDefaultValues?: WizardFormDefaults) {
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

    (useRepositoryStatus as jest.Mock).mockReturnValue({
      isReady: true,
      isLoading: false,
      hasError: false,
      isHealthy: true,
      isReconciled: true,
      refetch: jest.fn(),
      hasTimedOut: false,
      resetTimeout: jest.fn(),
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

    (useModeOptions as jest.Mock).mockReturnValue({
      enabledOptions: [
        {
          target: 'folder',
          label: 'Sync external storage to a new Grafana folder',
          description: 'A new Grafana folder will be created',
          subtitle: 'Use this option to sync into a new folder',
        },
      ],
    });

    // Default to non-free tier (quota not enforced)
    (isFreeTierLicense as jest.Mock).mockReturnValue(false);
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
      expect(screen.getAllByText('External storage')).toHaveLength(1); // Only folder sync is shown by default
      expect(screen.getAllByText('Empty')).toHaveLength(2); // Two elements should have the role "Empty" (1 external + 1 unmanaged)
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

      expect(await screen.getAllByText('2 files')).toHaveLength(1); // Only folder sync is shown by default
    });

    it('should display resource counts when resources exist', async () => {
      // Note: Resource counts are only shown for instance sync, but instance sync is not available by default
      // This test is kept for when instance sync is explicitly enabled via settings
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

      // Mock settings to allow instance sync for this test
      (useModeOptions as jest.Mock).mockReturnValue({
        enabledOptions: [
          {
            target: 'instance',
            label: 'Sync all resources with external storage',
            description: 'Resources will be synced with external storage',
            subtitle: 'Use this option if you want to sync your entire instance',
          },
        ],
        disabledOptions: [],
      });

      setup({
        settingsData: {
          allowedTargets: ['instance', 'folder'],
          allowImageRendering: true,
          items: [],
          availableRepositoryTypes: [],
          maxRepositories: 10,
        },
      });

      expect(await screen.findByText('7 resources')).toBeInTheDocument();
    });
  });

  describe('hook integration', () => {
    it('should use useResourceStats hook correctly', async () => {
      setup();

      expect(useResourceStats).toHaveBeenCalledWith('test-repo', 'folder', undefined, {
        isHealthy: true,
        isReconciled: true,
      });
    });

    it('should use useResourceStats hook with settings data', async () => {
      setup({
        settingsData: {
          allowedTargets: ['folder'],
          allowImageRendering: true,
          items: [],
          availableRepositoryTypes: [],
          maxRepositories: 10,
        },
      });

      expect(useResourceStats).toHaveBeenCalledWith('test-repo', 'folder', undefined, {
        isHealthy: true,
        isReconciled: true,
      });
    });
  });

  describe('sync target options', () => {
    it('should display only folder option by default', async () => {
      setup();

      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
      expect(screen.queryByText('Sync all resources with external storage')).not.toBeInTheDocument();
    });

    it('should only display instance option when legacy storage exists and hide disabled options', async () => {
      (useModeOptions as jest.Mock).mockReturnValue({
        enabledOptions: [
          {
            target: 'instance',
            label: 'Sync all resources with external storage',
            description: 'Resources will be synced with external storage',
            subtitle: 'Use this option if you want to sync your entire instance',
          },
        ],
        disabledOptions: [
          {
            target: 'folder',
            label: 'Sync external storage to a new Grafana folder',
            description: 'A new Grafana folder will be created',
            subtitle: 'Use this option to sync into a new folder',
          },
        ],
      });

      setup({
        settingsData: {
          allowedTargets: ['instance', 'folder'],
          allowImageRendering: true,
          items: [],
          availableRepositoryTypes: [],
          maxRepositories: 10,
        },
      });

      expect(await screen.findByText('Sync all resources with external storage')).toBeInTheDocument();
      // Disabled options should not be rendered at all
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
    it('should show title field for folder sync target', async () => {
      setup();

      // Default is folder, so title field should be visible
      expect(await screen.findByRole('textbox', { name: /display name/i })).toBeInTheDocument();
    });
  });

  describe('quota exceeded', () => {
    it('should not render content when resource count exceeds free-tier limit on folder sync', () => {
      (isFreeTierLicense as jest.Mock).mockReturnValue(true);

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 25,
        resourceCount: 25, // Exceeds free-tier limit of 20
        resourceCountString: '25 resources',
        fileCountString: '25 files',
        isLoading: false,
        requiresMigration: false,
        shouldSkipSync: false,
      });

      setup();

      // Content should not be rendered when quota is exceeded on free tier
      expect(screen.queryByText('Sync external storage to a new Grafana folder')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /display name/i })).not.toBeInTheDocument();
    });

    it('should render content when resource count exceeds free-tier limit but not on free tier', async () => {
      (isFreeTierLicense as jest.Mock).mockReturnValue(false);

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 25,
        resourceCount: 25, // Exceeds limit but not on free tier
        resourceCountString: '25 resources',
        fileCountString: '25 files',
        isLoading: false,
        requiresMigration: false,
        shouldSkipSync: false,
      });

      setup();

      // Quota is not enforced when not on free tier
      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
    });

    it('should render content when resource count is within quota on free tier', async () => {
      (isFreeTierLicense as jest.Mock).mockReturnValue(true);

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 15,
        resourceCount: 15, // Within free-tier limit of 20
        resourceCountString: '15 resources',
        fileCountString: '15 files',
        isLoading: false,
        requiresMigration: false,
        shouldSkipSync: false,
      });

      setup();

      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
    });

    it('should render content when resource count equals quota limit on free tier', async () => {
      (isFreeTierLicense as jest.Mock).mockReturnValue(true);

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 20,
        resourceCount: 20, // Exactly at free-tier limit of 20
        resourceCountString: '20 resources',
        fileCountString: '20 files',
        isLoading: false,
        requiresMigration: false,
        shouldSkipSync: false,
      });

      setup();

      // Exactly at limit is allowed (only > limit triggers exceeded)
      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
    });

    it('should render content when resource count exceeds limit on free tier for instance sync', async () => {
      (isFreeTierLicense as jest.Mock).mockReturnValue(true);

      (useModeOptions as jest.Mock).mockReturnValue({
        enabledOptions: [
          {
            target: 'instance',
            label: 'Sync all resources with external storage',
            description: 'Resources will be synced with external storage',
            subtitle: 'Use this option if you want to sync your entire instance',
          },
        ],
        disabledOptions: [],
      });

      const mockUseResourceStats = require('./hooks/useResourceStats').useResourceStats;
      mockUseResourceStats.mockReturnValue({
        fileCount: 25,
        resourceCount: 25, // Exceeds limit but instance sync is not restricted
        resourceCountString: '25 resources',
        fileCountString: '25 files',
        isLoading: false,
        requiresMigration: false,
        shouldSkipSync: false,
      });

      setup(
        {},
        {
          repository: {
            sync: {
              target: 'instance',
              enabled: true,
            },
          },
        }
      );

      expect(await screen.findByText('Sync all resources with external storage')).toBeInTheDocument();
    });
  });
});
