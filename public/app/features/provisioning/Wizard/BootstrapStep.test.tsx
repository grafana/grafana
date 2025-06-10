import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import { useGetRepositoryFilesQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning';

import { BootstrapStep, Props } from './BootstrapStep';
import { StepStatusProvider } from './StepStatusContext';
import { getResourceStats, useModeOptions } from './actions';
import { WizardFormData } from './types';

jest.mock('app/api/clients/provisioning', () => ({
  useGetRepositoryFilesQuery: jest.fn(),
  useGetResourceStatsQuery: jest.fn(),
}));

jest.mock('./actions', () => ({
  getResourceStats: jest.fn(),
  useModeOptions: jest.fn(),
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
    onOptionSelect: jest.fn(),
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

    (getResourceStats as jest.Mock).mockReturnValue({
      fileCount: 0,
      resourceCount: 0,
      resourceCountString: '',
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

      setup();

      expect(screen.getByText('Loading resource information...')).toBeInTheDocument();
    });

    it('should render correct info for GitHub repository type', async () => {
      setup();
      expect(await screen.findByText('Grafana instance')).toBeInTheDocument();
      expect(screen.getByText('External storage')).toBeInTheDocument();
      expect(screen.getAllByText('Empty')).toHaveLength(2); // Both should show empty
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

      (getResourceStats as jest.Mock).mockReturnValue({
        fileCount: 2,
        resourceCount: 0,
        resourceCountString: '',
      });

      setup();

      expect(await screen.findByText('2 files')).toBeInTheDocument();
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

      (getResourceStats as jest.Mock).mockReturnValue({
        fileCount: 0,
        resourceCount: 7,
        resourceCountString: '7 resources',
      });

      setup();

      expect(await screen.findByText('7 resources')).toBeInTheDocument();
    });
  });

  describe('option selection', () => {
    it('should call onOptionSelect with correct argument when no migration needed', async () => {
      const { props } = setup();

      await waitFor(() => {
        expect(props.onOptionSelect).toHaveBeenCalledWith(false);
      });
    });

    it('should call onOptionSelect with true when legacy storage exists', async () => {
      const { props } = setup({
        settingsData: {
          legacyStorage: true,
          items: [],
        },
      });

      await waitFor(() => {
        expect(props.onOptionSelect).toHaveBeenCalledWith(true);
      });
    });

    it('should call onOptionSelect with true when resources exist', async () => {
      (useGetResourceStatsQuery as jest.Mock).mockReturnValue({
        data: {
          instance: [{ group: 'dashboard.grafana.app', count: 1 }],
        },
        isLoading: false,
      });

      (getResourceStats as jest.Mock).mockReturnValue({
        fileCount: 0,
        resourceCount: 1,
        resourceCountString: '1 resource',
      });

      const { props } = setup();

      await waitFor(() => {
        expect(props.onOptionSelect).toHaveBeenCalledWith(true);
      });
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
