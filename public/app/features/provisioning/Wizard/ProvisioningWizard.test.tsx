import { QueryStatus } from '@reduxjs/toolkit/query';
import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

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
}));

const mockUseCreateOrUpdateRepository = useCreateOrUpdateRepository as jest.MockedFunction<
  typeof useCreateOrUpdateRepository
>;
const mockUseGetFrontendSettingsQuery = useGetFrontendSettingsQuery as jest.MockedFunction<
  typeof useGetFrontendSettingsQuery
>;

function setup(jsx: JSX.Element) {
  return render(<StepStatusProvider>{jsx}</StepStatusProvider>);
}

// Helper function to type into SecretInput with provider-specific placeholder
async function typeIntoTokenField(user: any, placeholder: string, value: string) {
  // Check if token field is configured (showing Reset button)
  const resetButton = screen.queryByRole('button', { name: /Reset/i });
  if (resetButton) {
    await user.click(resetButton);
  }
  await user.type(screen.getByPlaceholderText(placeholder), value);
}

// Helper function to fill connection form based on repository type
async function fillConnectionForm(user: any, type: 'github' | 'gitlab' | 'bitbucket' | 'local', data: {
  token?: string;
  url?: string;
  branch?: string;
  path?: string;
}) {
  // Token field (only for git providers)
  if (type !== 'local' && data.token) {
    const tokenPlaceholders = {
      github: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      gitlab: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      bitbucket: 'ATBBxxxxxxxxxxxxxxxx',
    };
    await typeIntoTokenField(user, tokenPlaceholders[type], data.token);
  }

  // Repository URL (only for git providers)
  if (type !== 'local' && data.url) {
    await user.type(screen.getByRole('textbox', { name: /Repository URL/i }), data.url);
  }

  // Branch (only for git providers)
  if (type !== 'local' && data.branch) {
    await user.type(screen.getByRole('textbox', { name: /Branch/i }), data.branch);
  }

  // Path (for all providers)
  if (data.path) {
    await user.type(screen.getByRole('textbox', { name: /Path/i }), data.path);
  }
}

describe('ProvisioningWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the settings query
    mockUseGetFrontendSettingsQuery.mockReturnValue({
      data: {
        items: [],
        legacyStorage: false,
        availableRepositoryTypes: ['github', 'gitlab', 'bitbucket', 'local'],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as ReturnType<typeof useGetFrontendSettingsQuery>);

    // Mock the create/update repository hook
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

    // Set up the mock to return success by default
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
      // Token field uses SecretInput which might not expose as textbox initially
      expect(screen.getByText('Personal Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Branch/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should progress through connection step when form is valid', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Fill connection form
      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      // Check for validation errors before submitting
      expect(screen.queryByText(/token is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/repository url is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/branch is required/i)).not.toBeInTheDocument();

      // Submit connection step
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should proceed to bootstrap step
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();
      });
    });

    it('should complete full wizard flow successfully', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Step 1: Connection - fill all required fields
      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      // Submit step 1
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should proceed to step 2
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();
      });

      // Verify the create/update repository hook was called
      expect(mockUseCreateOrUpdateRepository).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show field errors when connection test fails with TestResults error', async () => {
      // Mock the hook to throw an error with TestResults format
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

      // Fill form with invalid data
      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'invalid-branch',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should show field error
      await waitFor(() => {
        expect(screen.getByText('Branch "invalid-branch" not found')).toBeInTheDocument();
      });

      // Should stay on connection step
      expect(screen.getByRole('heading', { name: /1\. Connect to external storage/i })).toBeInTheDocument();
    });

    it('should show error alert for Status API errors', async () => {
      // Mock the hook to throw a Status error (generic error, not fetch error)
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

      // Fill form and submit
      await fillConnectionForm(user, 'gitlab', {
        token: 'invalid-token',
        url: 'https://gitlab.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should show error alert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Repository connection failed')).toBeInTheDocument();
      });

      // Should stay on connection step
      expect(screen.getByRole('heading', { name: /1\. Connect to external storage/i })).toBeInTheDocument();
    });

    it('should show error when repository creation fails', async () => {
      // Mock the hook to return an error in the response
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

      // Mock the response to have an error
      mockSubmitData.mockResolvedValue({
        error: {
          kind: 'Status',
          status: 'Failure',
          message: 'Repository creation failed',
          code: 500,
        },
      });

      const { user } = setup(<ProvisioningWizard type="github" />);

      // Fill connection form
      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should show error alert
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

      // Complete connection step to create repository
      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Now cancel from bootstrap step
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /2\. Choose what to synchronize/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      // Should navigate to provisioning page
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/provisioning');
      });
    });

    it('should disable next button when submitting', async () => {
      // Mock the hook to simulate a slow API call
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

      // Mock a slow response
      mockSubmitData.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const { user } = setup(<ProvisioningWizard type="github" />);

      // Fill form
      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      // Start submission
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Button should be disabled during submission
      expect(screen.getByRole('button', { name: /Submitting.../i })).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should not proceed to next step
      expect(screen.getByRole('heading', { name: /1\. Connect to external storage/i })).toBeInTheDocument();
    });

    it('should show button text changes based on current step', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Initially shows next step name
      expect(screen.getByRole('button', { name: /Choose what to synchronize/i })).toBeInTheDocument();

      // Complete connection step
      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'main',
        path: '/',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should show next step name
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
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Branch/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
    });

    it('should render local repository fields', async () => {
      setup(<ProvisioningWizard type="local" />);

      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
      // Should not show git-specific fields
      expect(screen.queryByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('glpat-xxxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ATBBxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Repository URL/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Branch/i })).not.toBeInTheDocument();
    });
  });
});
