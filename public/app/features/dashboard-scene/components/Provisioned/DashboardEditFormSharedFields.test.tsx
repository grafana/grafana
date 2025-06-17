import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { ProvisionedDashboardFormData } from '../../saving/shared';

import { DashboardEditFormSharedFields } from './DashboardEditFormSharedFields';

// Mock the i18n hook since it's used in the component
jest.mock('@grafana/i18n', () => ({
  t: (_: string, defaultValue: string) => defaultValue,
}));

// Mock the validation utilities
jest.mock('app/features/provisioning/utils/git', () => ({
  validateBranchName: jest.fn((value: string) => {
    if (!value || value.length < 3) {
      return 'Branch name must be at least 3 characters';
    }
    return true;
  }),
}));

// Mock the BranchValidationError component
jest.mock('app/features/provisioning/Shared/BranchValidationError', () => ({
  BranchValidationError: () => <div>Branch validation error</div>,
}));

interface FormWrapperProps {
  children: ReactNode;
  defaultValues?: Partial<ProvisionedDashboardFormData>;
}

const FormWrapper = ({ children, defaultValues = {} }: FormWrapperProps) => {
  const methods = useForm<ProvisionedDashboardFormData>({
    defaultValues: {
      path: '',
      comment: '',
      ref: '',
      workflow: 'write',
      ...defaultValues,
    },
    mode: 'onChange',
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const mockWorkflowOptions = [
  { label: 'Write directly', value: 'write' },
  { label: 'Create branch', value: 'branch' },
];

describe('DashboardEditFormSharedFields', () => {
  describe('Basic Rendering', () => {
    it('should render path and comment fields by default', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} />
        </FormWrapper>
      );

      expect(screen.getByRole('textbox', { name: /Path/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add a note to describe your changes (optional)')).toBeInTheDocument();
    });

    it('should not render workflow fields when isGitHub is false', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isGitHub={false} />
        </FormWrapper>
      );

      expect(screen.queryByText('Workflow')).not.toBeInTheDocument();
    });

    it('should render workflow fields when isGitHub is true', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isGitHub={true} />
        </FormWrapper>
      );

      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.getByText('Write directly')).toBeInTheDocument();
      expect(screen.getByText('Create branch')).toBeInTheDocument();
    });
  });

  describe('ReadOnly State', () => {
    it('should make path field readonly when readOnly is true', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} readOnly={true} />
        </FormWrapper>
      );

      const pathInput = screen.getByRole('textbox', { name: /path/i });
      expect(pathInput).toHaveAttribute('readonly');
    });

    it('should disable comment field when readOnly is true', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} readOnly={true} />
        </FormWrapper>
      );

      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });
      expect(commentTextarea).toBeDisabled();
    });

    it('should not render workflow fields when readOnly is true and isGitHub is true', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} readOnly={true} isGitHub={true} />
        </FormWrapper>
      );

      expect(screen.queryByText('Workflow')).not.toBeInTheDocument();
    });
  });

  describe('Workflow Fields', () => {
    it('should not render branch field when workflow is write', () => {
      render(
        <FormWrapper defaultValues={{ workflow: 'write' }}>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isGitHub={true} workflow="write" />
        </FormWrapper>
      );

      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.queryByText('Branch')).not.toBeInTheDocument();
    });

    it('should render branch field when workflow is branch', () => {
      render(
        <FormWrapper defaultValues={{ workflow: 'branch' }}>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isGitHub={true} workflow="branch" />
        </FormWrapper>
      );

      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.getByText('Branch')).toBeInTheDocument();
      expect(screen.getByText('Branch name in GitHub')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should allow typing in path field', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isNew={true} />
        </FormWrapper>
      );

      const pathInput = screen.getByRole('textbox', { name: /path/i });
      await user.type(pathInput, 'dashboards/test.json');

      expect(pathInput).toHaveValue('dashboards/test.json');
    });

    it('should allow typing in comment field', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} />
        </FormWrapper>
      );

      const commentTextarea = screen.getByRole('textbox', { name: /comment/i });
      await user.type(commentTextarea, 'Test comment');

      expect(commentTextarea).toHaveValue('Test comment');
    });

    it('should allow selecting workflow options', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isGitHub={true} />
        </FormWrapper>
      );

      const branchOption = screen.getByLabelText('Create branch');
      await user.click(branchOption);

      expect(branchOption).toBeChecked();
    });

    it('should allow typing in branch field when workflow is branch', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper defaultValues={{ workflow: 'branch' }}>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isGitHub={true} workflow="branch" />
        </FormWrapper>
      );

      const branchInput = screen.getByRole('textbox', { name: /branch/i });
      await user.type(branchInput, 'feature-branch');

      expect(branchInput).toHaveValue('feature-branch');
    });
  });

  describe('Form Integration', () => {
    it('should update form state when fields are changed', async () => {
      const user = userEvent.setup();
      let formValues: Partial<ProvisionedDashboardFormData> | undefined;

      const TestComponent = () => {
        const methods = useForm<ProvisionedDashboardFormData>({
          defaultValues: { path: '', comment: '', ref: '', workflow: 'write' },
        });

        // Capture form values for assertion
        formValues = methods.watch();

        return (
          <FormProvider {...methods}>
            <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isNew={true} />
          </FormProvider>
        );
      };

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
      const user = userEvent.setup();

      render(
        <FormWrapper defaultValues={{ workflow: 'branch' }}>
          <DashboardEditFormSharedFields workflowOptions={mockWorkflowOptions} isGitHub={true} workflow="branch" />
        </FormWrapper>
      );

      const branchInput = screen.getByRole('textbox', { name: /branch/i });
      await user.type(branchInput, 'ab'); // Short branch name to trigger validation

      // Trigger validation by blurring the field
      await user.tab();

      // Check if validation error appears
      expect(screen.getByText('Branch validation error')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty workflowOptions', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields workflowOptions={[]} isGitHub={true} />
        </FormWrapper>
      );

      expect(screen.getByText('Workflow')).toBeInTheDocument();
    });

    it('should handle undefined props', () => {
      render(
        <FormWrapper>
          <DashboardEditFormSharedFields
            workflowOptions={mockWorkflowOptions}
            readOnly={undefined}
            isGitHub={undefined}
          />
        </FormWrapper>
      );

      expect(screen.getByText('Path')).toBeInTheDocument();
      expect(screen.getByText('Comment')).toBeInTheDocument();
    });
  });
});
