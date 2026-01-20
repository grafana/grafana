import { QueryStatus } from '@reduxjs/toolkit/query';
import { screen } from '@testing-library/react';
import { UserEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { render } from 'test/test-utils';

import {
  useCreateRepositoryJobsMutation,
  useGetFrontendSettingsQuery,
  useGetRepositoryFilesQuery,
  useGetRepositoryStatusQuery,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { useBranchOptions } from '../hooks/useBranchOptions';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';

import { ProvisioningWizard } from './ProvisioningWizard';
import { StepStatusProvider } from './StepStatusContext';

const mockNavigate = jest.fn();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../hooks/useCreateOrUpdateRepository');
jest.mock('../hooks/useBranchOptions');
jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetFrontendSettingsQuery: jest.fn(),
  useGetRepositoryFilesQuery: jest.fn(),
  useGetRepositoryStatusQuery: jest.fn(),
  useGetResourceStatsQuery: jest.fn(),
  useCreateRepositoryJobsMutation: jest.fn(),
}));

const mockUseCreateOrUpdateRepository = useCreateOrUpdateRepository as jest.MockedFunction<
  typeof useCreateOrUpdateRepository
>;
const mockUseBranchOptions = useBranchOptions as jest.MockedFunction<typeof useBranchOptions>;
const mockUseGetFrontendSettingsQuery = useGetFrontendSettingsQuery as jest.MockedFunction<
  typeof useGetFrontendSettingsQuery
>;
const mockUseGetRepositoryFilesQuery = useGetRepositoryFilesQuery as jest.MockedFunction<
  typeof useGetRepositoryFilesQuery
>;
const mockUseGetRepositoryStatusQuery = useGetRepositoryStatusQuery as jest.MockedFunction<
  typeof useGetRepositoryStatusQuery
>;
const mockUseGetResourceStatsQuery = useGetResourceStatsQuery as jest.MockedFunction<typeof useGetResourceStatsQuery>;
const mockUseCreateRepositoryJobsMutation = useCreateRepositoryJobsMutation as jest.MockedFunction<
  typeof useCreateRepositoryJobsMutation
>;

function setup(jsx: JSX.Element) {
  return render(<StepStatusProvider>{jsx}</StepStatusProvider>);
}

async function typeIntoTokenField(user: UserEvent, placeholder: string, value: string) {
  const resetButton = screen.queryByRole('button', { name: /Reset/i });
  if (resetButton) {
    await user.click(resetButton);
  }
  await user.type(screen.getByPlaceholderText(placeholder), value);
}

async function navigateToConnectionStep(user: UserEvent, type: 'github' | 'gitlab' | 'bitbucket' | 'local' | 'git') {
  // For GitHub, we need to pass through the AuthType step first
  if (type === 'github') {
    // Click the "Connect" button to proceed from AuthType step to Connection step
    await user.click(screen.getByRole('button', { name: /Connect$/i }));

    // Wait for the connection step to appear
    expect(await screen.findByRole('heading', { name: /Connect to external storage/i })).toBeInTheDocument();
  }
}

async function fillConnectionForm(
  user: UserEvent,
  type: 'github' | 'gitlab' | 'bitbucket' | 'local' | 'git',
  data: {
    token?: string;
    tokenUser?: string;
    url?: string;
    branch?: string;
    path?: string;
  }
) {
  // First navigate to the connection step (handles AuthType step for GitHub)
  await navigateToConnectionStep(user, type);

  if (type !== 'local' && data.token) {
    const tokenPlaceholders = {
      github: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      gitlab: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      bitbucket: 'ATBBxxxxxxxxxxxxxxxx',
      git: 'token or password',
    };
    await typeIntoTokenField(user, tokenPlaceholders[type], data.token);
  }

  if ((type === 'bitbucket' || type === 'git') && data.tokenUser) {
    await user.type(screen.getByPlaceholderText('username'), data.tokenUser);
  }

  if (type !== 'local' && data.url) {
    await user.type(screen.getByRole('textbox', { name: /Repository URL/i }), data.url);
  }

  if (type !== 'local' && data.branch) {
    await user.type(screen.getByRole('combobox'), data.branch);
  }

  if (data.path) {
    await user.type(screen.getByRole('textbox', { name: /Path/i }), data.path);
  }
}

describe('ProvisioningWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useBranchOptions to prevent real API calls
    mockUseBranchOptions.mockReturnValue({
      options: [
        { label: 'main', value: 'main' },
        { label: 'develop', value: 'develop' },
      ],
      loading: false,
      error: null,
    });

    mockUseGetFrontendSettingsQuery.mockReturnValue({
      data: {
        items: [],
        allowImageRendering: true,
        availableRepositoryTypes: ['github', 'gitlab', 'bitbucket', 'git', 'local'],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseGetRepositoryFilesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseGetRepositoryStatusQuery.mockReturnValue({
      data: {
        status: {
          health: {
            healthy: true,
            checked: true,
            message: '',
          },
        },
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseGetResourceStatsQuery.mockReturnValue({
      data: {
        instance: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const mockCreateJob = jest.fn();
    mockUseCreateRepositoryJobsMutation.mockReturnValue([
      mockCreateJob,
      {
        status: QueryStatus.uninitialized,
        isLoading: false,
        error: null,
        data: undefined,
        isUninitialized: true,
        isSuccess: false,
        isError: false,
        reset: jest.fn(),
      },
    ]);

    const mockSubmitData = jest.fn();
    const mockMutationState = {
      status: QueryStatus.uninitialized,
      isLoading: false,
      error: null,
      data: undefined,
      isUninitialized: true,
      isSuccess: false,
      isError: false,
      reset: jest.fn(),
    };
    (mockUseCreateOrUpdateRepository as jest.Mock).mockReturnValue([
      mockSubmitData,
      mockMutationState,
      mockMutationState,
    ]);

    mockSubmitData.mockResolvedValue({
      data: {
        metadata: {
          name: 'test-repo-abc123',
        },
        spec: {
          type: 'github',
          title: 'Test Repository',
        },
      },
    });
  });

  describe('Happy Path', () => {
    it('should render auth type step initially for GitHub', async () => {
      setup(<ProvisioningWizard type="github" />);

      // GitHub wizard now shows AuthType step first
      expect(screen.getByRole('heading', { name: /Choose connection type/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect with Personal Access Token/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect with GitHub App/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect$/i })).toBeInTheDocument();
    });

    it('should render connection step after selecting auth type', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Navigate to connection step
      await user.click(screen.getByRole('button', { name: /Connect$/i }));

      expect(await screen.findByRole('heading', { name: /Connect to external storage/i })).toBeInTheDocument();

      expect(screen.getByText('Personal Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should progress through first 3 steps successfully', async () => {
      mockUseGetResourceStatsQuery.mockReturnValue({
        data: {
          instance: [{ group: 'dashboard.grafana.app', count: 1 }],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      // Mock files to ensure sync step is not skipped for folder sync
      mockUseGetRepositoryFilesQuery.mockReturnValue({
        data: {
          items: [{ name: 'test.json', path: 'test.json' }],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();

      expect(mockUseCreateOrUpdateRepository).toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /Synchronize with external storage/i }));

      expect(
        await screen.findByRole('heading', { name: /3\. Synchronize with external storage/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Begin synchronization/i })).toBeInTheDocument();
    });

    it('should skip sync step when there are no resources', async () => {
      mockUseGetResourceStatsQuery.mockReturnValue({
        data: {
          instance: [], // No resources
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      mockUseGetRepositoryFilesQuery.mockReturnValue({
        data: {
          items: [], // No files
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as ReturnType<typeof useGetRepositoryFilesQuery>);

      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();

      // Should show "Choose additional settings" button instead of "Synchronize with external storage"
      expect(screen.getByRole('button', { name: /Choose additional settings/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Synchronize with external storage/i })).not.toBeInTheDocument();

      // Verify that the sync step (step 3) would be skipped in the button text logic
      const nextButton = screen.getByRole('button', { name: /Choose additional settings/i });
      expect(nextButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show field errors when connection test fails with TestResults error', async () => {
      const mockSubmitData = jest.fn();
      const mockMutationState = {
        status: QueryStatus.uninitialized,
        isLoading: false,
        error: null,
      };
      (mockUseCreateOrUpdateRepository as jest.Mock).mockReturnValue([
        mockSubmitData,
        mockMutationState,
        mockMutationState,
      ]);

      const testResultsError = {
        data: {
          kind: 'TestResults',
          apiVersion: 'provisioning.grafana.app/v0alpha1',
          success: false,
          code: 400,
          errors: [
            {
              type: 'FieldValueInvalid',
              field: 'spec.github.branch',
              detail: 'Branch "invalid-branch" not found',
            },
          ],
        },
        status: 400,
      };

      mockSubmitData.mockRejectedValue(testResultsError);

      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'invalid-branch',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByText('Branch "invalid-branch" not found')).toBeInTheDocument();

      expect(screen.getByRole('heading', { name: /1\. Connect to external storage/i })).toBeInTheDocument();
    });

    it('should show error alert for Status API errors', async () => {
      const mockSubmitData = jest.fn();
      const mockMutationState = {
        status: QueryStatus.uninitialized,
        isLoading: false,
        error: null,
      };
      (mockUseCreateOrUpdateRepository as jest.Mock).mockReturnValue([
        mockSubmitData,
        mockMutationState,
        mockMutationState,
      ]);

      const statusError = new Error('decrypt gitlab token: not found');
      mockSubmitData.mockRejectedValue(statusError);

      const { user } = setup(<ProvisioningWizard type="gitlab" />);

      await fillConnectionForm(user, 'gitlab', {
        token: 'invalid-token',
        url: 'https://gitlab.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Repository connection failed')).toBeInTheDocument();

      expect(screen.getByRole('heading', { name: /1\. Connect to external storage/i })).toBeInTheDocument();
    });

    it('should show error when repository creation fails', async () => {
      const mockSubmitData = jest.fn();
      const mockMutationState = {
        status: QueryStatus.uninitialized,
        isLoading: false,
        error: null,
      };
      (mockUseCreateOrUpdateRepository as jest.Mock).mockReturnValue([
        mockSubmitData,
        mockMutationState,
        mockMutationState,
      ]);

      mockSubmitData.mockResolvedValue({
        error: {
          kind: 'Status',
          status: 'Failure',
          message: 'Repository creation failed',
          code: 500,
        },
      });

      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(await screen.findByText('Repository request failed')).toBeInTheDocument();
    });
  });

  describe('Navigation and State', () => {
    it('should handle cancel on first step', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // First step is now AuthType step for GitHub
      expect(screen.getByRole('heading', { name: /Choose connection type/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/provisioning');
    });

    it('should handle going back to previous step', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByRole('heading', { name: /Choose what to synchronize/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Previous/i }));

      expect(await screen.findByRole('heading', { name: /Connect to external storage/i })).toBeInTheDocument();
    });

    it('should disable next button when submitting', async () => {
      const mockSubmitData = jest.fn();
      const mockMutationState = {
        status: QueryStatus.uninitialized,
        isLoading: false,
        error: null,
        data: undefined,
        isUninitialized: true,
        isSuccess: false,
        isError: false,
        reset: jest.fn(),
      };

      (mockUseCreateOrUpdateRepository as jest.Mock).mockReturnValue([
        mockSubmitData,
        mockMutationState,
        mockMutationState,
      ]);

      mockSubmitData.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      // Click the submit button on the connection step
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Button should be disabled while submitting
      expect(await screen.findByRole('button', { name: /Submitting.../i })).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields on connection step', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Navigate to connection step first
      await user.click(screen.getByRole('button', { name: /Connect$/i }));

      expect(await screen.findByRole('heading', { name: /Connect to external storage/i })).toBeInTheDocument();

      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should still be on connection step due to validation
      expect(screen.getByRole('heading', { name: /Connect to external storage/i })).toBeInTheDocument();
    });

    it('should show button text changes based on current step', async () => {
      // Mock files to ensure sync step is not skipped for folder sync
      mockUseGetRepositoryFilesQuery.mockReturnValue({
        data: {
          items: [{ name: 'test.json', path: 'test.json' }],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { user } = setup(<ProvisioningWizard type="github" />);

      // First step shows "Connect" button
      expect(screen.getByRole('button', { name: /Connect$/i })).toBeInTheDocument();

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      // Connection step shows "Choose what to synchronize" button
      expect(screen.getByRole('button', { name: /Choose what to synchronize/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByRole('button', { name: /Synchronize with external storage/i })).toBeInTheDocument();
    });
  });

  describe('Different Repository Types', () => {
    it('should render GitLab-specific fields', async () => {
      setup(<ProvisioningWizard type="gitlab" />);

      expect(screen.getByText('Project Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should render Bitbucket-specific fields', async () => {
      setup(<ProvisioningWizard type="bitbucket" />);

      expect(screen.getByText('App Password *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Username/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should render Git-specific fields', async () => {
      setup(<ProvisioningWizard type="git" />);

      expect(screen.getByText('Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Username/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should render local repository fields', async () => {
      setup(<ProvisioningWizard type="local" />);

      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('glpat-xxxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ATBBxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Repository URL/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should accept tokenUser input for Bitbucket provider', async () => {
      const { user } = setup(<ProvisioningWizard type="bitbucket" />);

      await fillConnectionForm(user, 'bitbucket', {
        token: 'test-token',
        tokenUser: 'test-user',
        url: 'https://bitbucket.org/test/repo',
        branch: 'main',
        path: '/',
      });

      expect(screen.getByDisplayValue('test-user')).toBeInTheDocument();
    });

    it('should accept tokenUser input for Git provider', async () => {
      const { user } = setup(<ProvisioningWizard type="git" />);

      await fillConnectionForm(user, 'git', {
        token: 'test-token',
        tokenUser: 'test-user',
        url: 'https://git.example.com/test/repo.git',
        branch: 'main',
        path: '/',
      });

      expect(screen.getByDisplayValue('test-user')).toBeInTheDocument();
    });
  });
});
