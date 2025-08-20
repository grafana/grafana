import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { ProvisionedDashboardFormData } from '../../types/form';
import { ResourceEditFormSharedFields } from '../ResourceEditFormSharedFields';

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

// Mock the i18n hook since it's used in the component
jest.mock('@grafana/i18n', () => ({
  t: (_: string, defaultValue: string) => defaultValue,
  Trans: ({ children }: { children: ReactNode }) => children,
}));

interface SetupOptions {
  formDefaultValues?: Partial<ProvisionedDashboardFormData>;
  workflowOptions?: Array<{ label: string; value: string }>;
  isNew?: boolean;
  readOnly?: boolean;
  workflow?: 'write' | 'branch';
  repository?: RepositoryView;
}

function setup(options: SetupOptions = {}) {
  const {
    formDefaultValues = {},
    workflowOptions = [
      { label: 'Write directly', value: 'write' },
      { label: 'Create branch', value: 'branch' },
    ],
    isNew,
    readOnly,
    workflow,
    repository,
  } = options;

  const user = userEvent.setup();

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
    workflowOptions,
    isNew,
    readOnly,
    workflow,
    repository,
  };

  return {
    user,
    ...render(
      <FormWrapper>
        <ResourceEditFormSharedFields {...componentProps} resourceType="dashboard" />
      </FormWrapper>
    ),
  };
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
      setup({ repository: mockRepo.github });

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Write directly' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Create branch' })).toBeInTheDocument();
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
  });

  describe('Workflow Fields', () => {
    it('should not render branch field when workflow is write', () => {
      setup({ formDefaultValues: { workflow: 'write' }, repository: mockRepo.github, workflow: 'write' });

      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /branch/i })).not.toBeInTheDocument();
    });

    it('should render branch field when workflow is branch', () => {
      setup({ formDefaultValues: { workflow: 'branch' }, repository: mockRepo.github, workflow: 'branch' });

      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /branch/i })).toBeInTheDocument();
      expect(screen.getByText('Branch name in GitHub')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should allow typing in path field', async () => {
      const { user } = setup({ isNew: true });

      const pathInput = screen.getByRole('textbox', { name: /path/i });
      await user.type(pathInput, 'dashboards/test.json');

      expect(pathInput).toHaveValue('dashboards/test.json');
    });

    it('should allow typing in comment field', async () => {
      const { user } = setup();

      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });
      await user.type(commentTextarea, 'Test comment');

      expect(commentTextarea).toHaveValue('Test comment');
    });

    it('should allow selecting workflow options', async () => {
      const { user } = setup({ repository: mockRepo.github });

      const branchOption = screen.getByRole('radio', { name: 'Create branch' });
      await user.click(branchOption);

      expect(branchOption).toBeChecked();
    });

    it('should allow typing in branch field when workflow is branch', async () => {
      const { user } = setup({
        formDefaultValues: { workflow: 'branch' },
        repository: mockRepo.github,
        workflow: 'branch',
      });

      const branchInput = screen.getByRole('textbox', { name: /branch/i });
      await user.type(branchInput, 'feature-branch');

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
            <ResourceEditFormSharedFields
              workflowOptions={[
                { label: 'Write directly', value: 'write' },
                { label: 'Create branch', value: 'branch' },
              ]}
              isNew={true}
              resourceType="dashboard"
            />
          </FormProvider>
        );
      };

      const user = userEvent.setup();
      render(<TestComponent />);

      const pathInput = screen.getByRole('textbox', { name: /path/i });
      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });

      await user.type(pathInput, 'test.json');
      await user.type(commentTextarea, 'Test comment');

      expect(formValues?.path).toBe('test.json');
      expect(formValues?.comment).toBe('Test comment');
    });
  });

  describe('Validation', () => {
    it('should show validation error for invalid branch name', async () => {
      const { user } = setup({
        formDefaultValues: { workflow: 'branch' },
        repository: mockRepo.github,
        workflow: 'branch',
      });

      const branchInput = screen.getByRole('textbox', { name: /branch/i });
      await user.type(branchInput, 'invalid//branch'); // Invalid branch name with consecutive slashes

      // Trigger validation by blurring the field
      await user.tab();

      // Check if validation error appears
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty workflowOptions', () => {
      setup({ workflowOptions: [], repository: mockRepo.github });

      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('should handle undefined props', () => {
      setup({ readOnly: undefined, repository: mockRepo.local });

      expect(screen.getByRole('textbox', { name: /Path/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
    });
  });
});
