import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { WorkflowFields } from './WorkflowFields';

// Mock the dependencies
jest.mock('@grafana/i18n', () => ({
  t: (_: string, defaultValue: string) => defaultValue,
}));

jest.mock('app/features/provisioning/Shared/BranchValidationError', () => ({
  BranchValidationError: () => <div>Invalid branch name error</div>,
}));

jest.mock('app/features/provisioning/utils/git', () => ({
  validateBranchName: (branchName?: string) => {
    // Simple validation for testing - reject empty, spaces, and invalid chars
    return branchName && branchName.trim().length > 0 && !/[~^:?*[\]\\]/.test(branchName);
  },
}));

interface FormData {
  workflow: string;
  ref: string;
}

interface FormWrapperProps {
  children: ReactNode;
  defaultValues?: Partial<FormData>;
}

const FormWrapper = ({ children, defaultValues = {} }: FormWrapperProps) => {
  const methods = useForm<FormData>({
    defaultValues: { workflow: 'write', ref: '', ...defaultValues },
    mode: 'onChange',
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('WorkflowFields', () => {
  const mockWorkflowOptions = [
    { label: 'Write directly', value: 'write' },
    { label: 'Create branch', value: 'branch' },
  ];

  describe('Rendering', () => {
    it('should render workflow radio button group', () => {
      render(
        <FormWrapper>
          <WorkflowFields workflow="write" workflowOptions={mockWorkflowOptions} />
        </FormWrapper>
      );

      expect(screen.getByText('Workflow')).toBeInTheDocument();
      expect(screen.getByText('Write directly')).toBeInTheDocument();
      expect(screen.getByText('Create branch')).toBeInTheDocument();
    });

    it('should not show branch field when workflow is write', () => {
      render(
        <FormWrapper defaultValues={{ workflow: 'write' }}>
          <WorkflowFields workflow="write" workflowOptions={mockWorkflowOptions} />
        </FormWrapper>
      );

      expect(screen.queryByText('Branch')).not.toBeInTheDocument();
      expect(screen.queryByText('Branch name in GitHub')).not.toBeInTheDocument();
    });

    it('should show branch field when workflow is branch', () => {
      render(
        <FormWrapper defaultValues={{ workflow: 'branch' }}>
          <WorkflowFields workflow="branch" workflowOptions={mockWorkflowOptions} />
        </FormWrapper>
      );

      expect(screen.getByText('Branch')).toBeInTheDocument();
      expect(screen.getByText('Branch name in GitHub')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should allow selecting workflow options', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <WorkflowFields workflow="write" workflowOptions={mockWorkflowOptions} />
        </FormWrapper>
      );

      const branchOption = screen.getByLabelText('Create branch');
      await user.click(branchOption);

      expect(branchOption).toBeChecked();
    });

    it('should allow typing in branch name field', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper defaultValues={{ workflow: 'branch' }}>
          <WorkflowFields workflow="branch" workflowOptions={mockWorkflowOptions} />
        </FormWrapper>
      );

      const branchInput = screen.getByRole('textbox');
      await user.type(branchInput, 'feature-branch');

      expect(branchInput).toHaveValue('feature-branch');
    });
  });
});
