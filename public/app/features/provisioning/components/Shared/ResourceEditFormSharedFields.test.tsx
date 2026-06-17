import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, renderHook, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useBranchDropdownOptions } from '../../hooks/useBranchDropdownOptions';
import { useGetRepositoryFolders } from '../../hooks/useGetRepositoryFolders';
import { setupProvisioningMswServer } from '../../mocks/server';
import { type ProvisionedDashboardFormData } from '../../types/form';

import { ResourceEditFormSharedFields } from './ResourceEditFormSharedFields';

setupProvisioningMswServer();

// Mock the new hooks that depend on router context
jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useGetRepositoryFolders', () => ({
  useGetRepositoryFolders: jest.fn().mockReturnValue({ options: [], loading: false, error: null }),
}));

const mockRepo: { github: RepositoryView; local: RepositoryView } = {
  github: {
    type: 'github',
    name: 'test-repo',
    title: 'Test Repo',
    workflows: ['branch', 'write'],
    target: 'folder',
  },
  local: {
    type: 'local',
    name: 'local-repo',
    title: 'Local Repo',
    workflows: [],
    target: 'folder',
  },
};

interface SetupOptions {
  formDefaultValues?: Partial<ProvisionedDashboardFormData>;
  isNew?: boolean;
  readOnly?: boolean;
  workflow?: 'write' | 'branch';
  repository?: RepositoryView;
  canPushToConfiguredBranch?: boolean;
  allowPathEdit?: boolean;
  lockComment?: boolean;
}

function setup(options: SetupOptions = {}) {
  const {
    formDefaultValues = {},
    canPushToConfiguredBranch = true,
    isNew,
    readOnly,
    workflow,
    repository,
    allowPathEdit,
    lockComment,
  } = options;

  const defaultFormValues: Partial<ProvisionedDashboardFormData> = {
    path: '',
    comment: '',
    ref: '',
    workflow: 'write',
    ...formDefaultValues,
  };

  const FormWrapper = ({ children }: { children: ReactNode }) => {
    const methods = useForm<ProvisionedDashboardFormData>({
      defaultValues: defaultFormValues,
      mode: 'onChange',
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  const componentProps = {
    canPushToConfiguredBranch,
    isNew,
    readOnly,
    workflow,
    repository,
    allowPathEdit,
    lockComment,
  };

  return render(
    <FormWrapper>
      <ResourceEditFormSharedFields {...componentProps} resourceType="dashboard" />
    </FormWrapper>
  );
}

describe('ResourceEditFormSharedFields', () => {
  describe('Basic Rendering', () => {
    it('should render path and comment fields by default', () => {
      setup();

      expect(screen.getByRole('textbox', { name: /Path/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
    });

    it('should not render workflow fields when repository is false', () => {
      setup({ repository: mockRepo.local });

      expect(screen.queryByText('Workflow')).not.toBeInTheDocument();
    });

    it('should render workflow fields when repository is true', () => {
      setup({ repository: mockRepo.github, workflow: 'write', formDefaultValues: { workflow: 'write' } });

      expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
    });
  });

  describe('ReadOnly State', () => {
    it('should make path field readonly when readOnly is true', () => {
      setup({ readOnly: true });

      const pathInput = screen.getByRole('textbox', { name: /path/i });
      expect(pathInput).toHaveAttribute('readonly');
    });

    it('should disable comment field when readOnly is true', () => {
      setup({ readOnly: true });

      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });
      expect(commentTextarea).toBeDisabled();
    });

    it('should not render workflow fields when readOnly is true and repository is true', () => {
      setup({ readOnly: true, repository: mockRepo.github });

      expect(screen.queryByText('Workflow')).not.toBeInTheDocument();
    });

    it('should make comment field readonly but not disabled when lockComment is true', () => {
      setup({ lockComment: true });

      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });
      expect(commentTextarea).toHaveAttribute('readonly');
      expect(commentTextarea).toBeEnabled();
    });
  });

  describe('Workflow Fields', () => {
    it('should render branch field when workflow is write', () => {
      setup({ formDefaultValues: { workflow: 'write' }, repository: mockRepo.github, workflow: 'write' });

      expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
    });

    it('should render branch field when workflow is branch', () => {
      setup({ formDefaultValues: { workflow: 'branch' }, repository: mockRepo.github, workflow: 'branch' });

      expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
    });

    it('should render a read-only branch input when only configured branch is allowed', () => {
      const restrictedRepo: RepositoryView = {
        ...mockRepo.github,
        workflows: ['write'],
      };

      setup({
        formDefaultValues: { workflow: 'write', ref: 'main' },
        repository: restrictedRepo,
        workflow: 'write',
        canPushToConfiguredBranch: true,
      });

      const branchInput = screen.getByLabelText(/branch/i);
      expect(branchInput).toHaveAttribute('readonly');
      expect(screen.queryByRole('combobox', { name: /branch/i })).not.toBeInTheDocument();
    });

    it('should allow selecting a branch when only non-configured branches are allowed', () => {
      setup({
        formDefaultValues: { workflow: 'write' },
        repository: mockRepo.github,
        workflow: 'write',
        canPushToConfiguredBranch: false,
      });

      expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
      expect(screen.queryByText('This repository is restricted to the configured branch only')).not.toBeInTheDocument();
    });

    it('should disable the configured branch option when configured branch pushes are not allowed', () => {
      const { result } = renderHook(() =>
        useBranchDropdownOptions({
          repository: { ...mockRepo.github, branch: 'main' },
          branchData: { items: [] },
          canPushToConfiguredBranch: false,
          canPushToNonConfiguredBranch: true,
        })
      );

      const configuredOption = result.current[0];
      expect(configuredOption.value).toBe('main');
      expect(configuredOption.infoOption).toBe(true);
      expect(configuredOption.label).toBe('main (read-only)');
    });

    it('should add selected custom branch as a new option', () => {
      const customBranch = 'feature/new-branch';

      const { result } = renderHook(() =>
        useBranchDropdownOptions({
          repository: { ...mockRepo.github, branch: 'main' },
          selectedBranch: customBranch,
          branchData: { items: [{ name: 'develop' }] },
          canPushToConfiguredBranch: true,
          canPushToNonConfiguredBranch: true,
        })
      );

      const customOption = result.current.find((option) => option.value === customBranch);
      expect(customOption).toEqual(
        expect.objectContaining({
          label: 'feature/new-branch',
          description: 'New branch',
          value: 'feature/new-branch',
        })
      );
    });

    it('should not mark selected branch as new when it already exists in repository refs', () => {
      const existingBranch = 'feature/existing-branch';

      const { result } = renderHook(() =>
        useBranchDropdownOptions({
          repository: { ...mockRepo.github, branch: 'main' },
          selectedBranch: existingBranch,
          branchData: { items: [{ name: existingBranch }] },
          canPushToConfiguredBranch: true,
          canPushToNonConfiguredBranch: true,
        })
      );

      const existingOption = result.current.find((option) => option.value === existingBranch);
      expect(existingOption).toEqual(
        expect.objectContaining({
          label: existingBranch,
          value: existingBranch,
        })
      );
    });
  });

  describe('User Interactions', () => {
    it('should render folder and filename fields for new dashboards', async () => {
      const { user } = setup({ isNew: true });

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      expect(screen.getByRole('combobox', { name: /folder/i })).toBeInTheDocument();

      await user.type(filenameInput, 'test.json');
      expect(filenameInput).toHaveValue('test.json');
    });

    it('should render folder and filename fields for existing dashboards when allowPathEdit is true', () => {
      setup({ isNew: false, allowPathEdit: true, formDefaultValues: { path: 'dashboards/my-dashboard.json' } });

      expect(screen.getByRole('combobox', { name: /folder/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /filename/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /folder/i })).toHaveValue('dashboards');
      expect(screen.getByRole('textbox', { name: /filename/i })).toHaveValue('my-dashboard.json');
      expect(screen.queryByRole('textbox', { name: /path/i })).not.toBeInTheDocument();
    });

    it('should render read-only path field for existing dashboards when allowPathEdit is false', () => {
      setup({ isNew: false, formDefaultValues: { path: 'dashboards/my-dashboard.json' } });

      const pathInput = screen.getByRole('textbox', { name: /path/i });
      expect(pathInput).toHaveAttribute('readonly');
      expect(screen.queryByRole('combobox', { name: /folder/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /filename/i })).not.toBeInTheDocument();
    });

    it('should allow typing in comment field', async () => {
      const { user } = setup();

      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });
      await user.type(commentTextarea, 'Test comment');

      expect(commentTextarea).toHaveValue('Test comment');
    });

    it('should allow selecting a branch value', async () => {
      const { user } = setup({
        repository: mockRepo.github,
        workflow: 'write',
        formDefaultValues: { workflow: 'write' },
      });

      const branchInput = screen.getByRole('combobox', { name: /branch/i });
      await user.click(branchInput);
      await user.type(branchInput, 'feature-branch');
      await user.keyboard('{Enter}');

      expect(branchInput).toHaveValue('feature-branch');
    });

    it('should allow typing in branch field when workflow is branch', async () => {
      const { user } = setup({
        formDefaultValues: { workflow: 'branch' },
        repository: mockRepo.github,
        workflow: 'branch',
      });

      const branchInput = screen.getByRole('combobox', { name: /branch/i });
      await user.click(branchInput);
      await user.type(branchInput, 'feature-branch');
      await user.keyboard('{Enter}');

      expect(branchInput).toHaveValue('feature-branch');
    });
  });

  describe('Form Integration', () => {
    it('should update form state when fields are changed', async () => {
      let formValues: Partial<ProvisionedDashboardFormData> | undefined;

      const TestComponent = () => {
        const methods = useForm<ProvisionedDashboardFormData>({
          defaultValues: { path: '', comment: '', ref: '', workflow: 'write' },
        });

        // Capture form values for assertion
        formValues = methods.watch();

        return (
          <FormProvider {...methods}>
            <ResourceEditFormSharedFields canPushToConfiguredBranch={true} isNew={true} resourceType="dashboard" />
          </FormProvider>
        );
      };

      const { user } = render(<TestComponent />);

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });

      await user.type(filenameInput, 'test.json');
      await user.type(commentTextarea, 'Test comment');

      expect(formValues?.path).toBe('test.json');
      expect(formValues?.comment).toBe('Test comment');
    });

    it('should combine folder and filename into path value', async () => {
      let formValues: Partial<ProvisionedDashboardFormData> | undefined;

      const TestComponent = () => {
        const methods = useForm<ProvisionedDashboardFormData>({
          defaultValues: { path: 'dashboards/test.json', comment: '', ref: '', workflow: 'write' },
        });

        formValues = methods.watch();

        return (
          <FormProvider {...methods}>
            <ResourceEditFormSharedFields canPushToConfiguredBranch={true} isNew={true} resourceType="dashboard" />
          </FormProvider>
        );
      };

      const { user } = render(<TestComponent />);

      // Verify initial split
      expect(screen.getByRole('combobox', { name: /folder/i })).toHaveValue('dashboards');
      expect(screen.getByRole('textbox', { name: /filename/i })).toHaveValue('test.json');

      // Change filename and verify combined path
      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      await user.clear(filenameInput);
      await user.type(filenameInput, 'new-dashboard.json');

      expect(formValues?.path).toBe('dashboards/new-dashboard.json');
    });
  });

  describe('Validation', () => {
    it('should show validation error for invalid branch name', async () => {
      const { user } = setup({
        formDefaultValues: { workflow: 'branch' },
        repository: mockRepo.github,
        workflow: 'branch',
      });

      const branchInput = screen.getByRole('combobox', { name: /branch/i });
      await user.click(branchInput);
      await user.type(branchInput, 'invalid//branch'); // Invalid branch name with consecutive slashes
      await user.keyboard('{Enter}');

      // Trigger validation by blurring the field
      await user.tab();

      // Check if validation error appears
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Path validation for new dashboards', () => {
    let validationRequested: boolean;

    beforeEach(() => {
      validationRequested = false;
      // Default: file does not exist (404) — prevents MSW "unhandled request" warnings
      // for tests that render with isNew but don't care about the validation outcome.
      server.use(
        http.get(`${BASE}/repositories/:name/files/*`, () => {
          validationRequested = true;
          return new HttpResponse(null, { status: 404 });
        })
      );
    });

    it('should show error when file already exists at path', async () => {
      server.use(
        http.get(`${BASE}/repositories/:name/files/*`, () => {
          validationRequested = true;
          return HttpResponse.json({ path: 'existing.json' });
        })
      );

      const { user } = setup({
        isNew: true,
        repository: mockRepo.github,
        formDefaultValues: { path: 'dashboards/existing.json' },
      });

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      await user.clear(filenameInput);
      await user.type(filenameInput, 'test.json');

      await waitFor(() => {
        expect(screen.getByText('A file with this name already exists at this path')).toBeInTheDocument();
      });
    });

    it('should not show error when file does not exist (404)', async () => {
      const { user } = setup({
        isNew: true,
        repository: mockRepo.github,
        formDefaultValues: { path: 'dashboards/new-file.json' },
      });

      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      await user.clear(filenameInput);
      await user.type(filenameInput, 'test.json');

      await waitFor(() => {
        expect(validationRequested).toBe(true);
      });

      expect(screen.queryByText('A file with this name already exists at this path')).not.toBeInTheDocument();
    });

    it('should not validate path when not a new dashboard', () => {
      setup({
        isNew: false,
        repository: mockRepo.github,
        formDefaultValues: { path: 'dashboards/existing.json' },
      });

      expect(validationRequested).toBe(false);
    });

    it('should not validate path when isNew is not set', () => {
      setup({
        repository: mockRepo.github,
        formDefaultValues: { path: 'dashboards/existing.json' },
      });

      expect(validationRequested).toBe(false);
    });

    it('should trigger path validation when folder changes', async () => {
      // File exists at the new path → validation should fire and show error
      server.use(
        http.get(`${BASE}/repositories/:name/files/*`, () => {
          validationRequested = true;
          return HttpResponse.json({ path: 'existing.json' });
        })
      );

      // Provide folder options so the combobox has selectable items
      jest.mocked(useGetRepositoryFolders).mockReturnValue({
        hint: null,
        options: [{ label: 'other-folder', value: 'other-folder' }],
        loading: false,
        error: null,
      });

      const { user } = setup({
        isNew: true,
        repository: mockRepo.github,
        formDefaultValues: { path: 'dashboards/test.json' },
      });

      validationRequested = false;

      // Change folder via combobox
      const folderCombobox = screen.getByRole('combobox', { name: /folder/i });
      await user.clear(folderCombobox);
      await user.type(folderCombobox, 'other-folder');
      await user.keyboard('{Enter}');

      // shouldValidate: true means the path validator reruns after folder change
      await waitFor(() => {
        expect(validationRequested).toBe(true);
      });
    });

    it('should re-trigger path validation when the branch changes', async () => {
      const refsInRequest: string[] = [];
      server.use(
        http.get(`${BASE}/repositories/:name/files/*`, ({ request }) => {
          const url = new URL(request.url);
          refsInRequest.push(url.searchParams.get('ref') ?? '');
          return new HttpResponse(null, { status: 404 });
        })
      );

      const { user } = setup({
        isNew: true,
        repository: mockRepo.github,
        formDefaultValues: { path: 'dashboards/test.json', ref: 'main', workflow: 'write' },
      });

      // Seed the validator by editing the filename so the path field is touched.
      const filenameInput = screen.getByRole('textbox', { name: /filename/i });
      await user.clear(filenameInput);
      await user.type(filenameInput, 'check.json');
      await waitFor(() => expect(refsInRequest).toContain('main'));

      refsInRequest.length = 0;

      // Change branch → deps on the ref field should re-run validatePath.
      const branchCombobox = screen.getByRole('combobox', { name: /branch/i });
      await user.click(branchCombobox);
      await user.clear(branchCombobox);
      await user.paste('feature-branch');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(refsInRequest).toContain('feature-branch'));
    });
  });
});
