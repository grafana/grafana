import { QueryStatus } from '@reduxjs/toolkit/query';
import { screen, waitFor } from '@testing-library/react';
import { UserEvent } from '@testing-library/user-event';
import { render } from 'test/test-utils';

import {
  useCreateRepositoryJobsMutation,
  useGetFrontendSettingsQuery,
  useGetRepositoryFilesQuery,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';

import { ProvisioningWizard } from './ProvisioningWizard';
import { StepStatusProvider } from './StepStatusContext';

const mockNavigate = jest.fn();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
}));

jest.mock('../hooks/useCreateOrUpdateRepository');
jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetFrontendSettingsQuery: jest.fn(),
  useGetRepositoryFilesQuery: jest.fn(),
  useGetResourceStatsQuery: jest.fn(),
  useCreateRepositoryJobsMutation: jest.fn(),
}));

jest.mock('app/features/browse-dashboards/api/services', () => ({
  PAGE_SIZE: 20,
}));

const mockUseCreateOrUpdateRepository = useCreateOrUpdateRepository as jest.MockedFunction<
  typeof useCreateOrUpdateRepository
>;
const mockUseGetFrontendSettingsQuery = useGetFrontendSettingsQuery as jest.MockedFunction<
  typeof useGetFrontendSettingsQuery
>;
const mockUseGetRepositoryFilesQuery = useGetRepositoryFilesQuery as jest.MockedFunction<
  typeof useGetRepositoryFilesQuery
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
    await user.type(screen.getByRole('textbox', { name: /Branch/i }), data.branch);
  }

  if (data.path) {
    await user.type(screen.getByRole('textbox', { name: /Path/i }), data.path);
  }
}

describe('ProvisioningWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGetFrontendSettingsQuery.mockReturnValue({
      data: {
        items: [],
        legacyStorage: false,
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
    it('should render connection step initially', async () => {
      setup(<ProvisioningWizard type="github" />);

      expect(screen.getByRole('heading', { name: /1\. Connect to external storage/i })).toBeInTheDocument();
      expect(screen.getByText('Personal Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Branch/i })).toBeInTheDocument();
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
      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();
      });

      expect(mockUseCreateOrUpdateRepository).toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /Synchronize with external storage/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /3\. Synchronize with external storage/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Begin synchronization/i })).toBeInTheDocument();
      });
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

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();
      });

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

      await waitFor(() => {
        expect(screen.getByText('Branch "invalid-branch" not found')).toBeInTheDocument();
      });

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

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Repository connection failed')).toBeInTheDocument();
      });

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

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Repository request failed')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and State', () => {
    it('should handle cancel on first step', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/provisioning');
    });

    it('should handle cancel on subsequent steps with repository deletion', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/provisioning');
      });
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

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(screen.getByRole('button', { name: /Submitting.../i })).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(screen.getByRole('heading', { name: /1\. Connect to external storage/i })).toBeInTheDocument();
    });

    it('should show button text changes based on current step', async () => {
      // Mock resources to ensure sync step is not skipped
      mockUseGetResourceStatsQuery.mockReturnValue({
        data: {
          instance: [{ group: 'dashboard.grafana.app', count: 1 }],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { user } = setup(<ProvisioningWizard type="github" />);

      expect(screen.getByRole('button', { name: /Choose what to synchronize/i })).toBeInTheDocument();

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Synchronize with external storage/i })).toBeInTheDocument();
      });
    });
  });

  describe('Different Repository Types', () => {
    it('should render GitLab-specific fields', async () => {
      setup(<ProvisioningWizard type="gitlab" />);

      expect(screen.getByText('Project Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Branch/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should render Bitbucket-specific fields', async () => {
      setup(<ProvisioningWizard type="bitbucket" />);

      expect(screen.getByText('App Password *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Username/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Branch/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should render Git-specific fields', async () => {
      setup(<ProvisioningWizard type="git" />);

      expect(screen.getByText('Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Username/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Branch/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should render local repository fields', async () => {
      setup(<ProvisioningWizard type="local" />);

      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('glpat-xxxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ATBBxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Repository URL/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Branch/i })).not.toBeInTheDocument();
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
