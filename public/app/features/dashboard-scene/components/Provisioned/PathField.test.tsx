import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { PathField } from './PathField';

jest.mock('@grafana/i18n', () => ({
  t: (_: string, defaultValue: string) => defaultValue,
}));

interface FormData {
  path: string;
}

interface FormWrapperProps {
  children: ReactNode;
  defaultValues?: Partial<FormData>;
}

const FormWrapper = ({ children, defaultValues = {} }: FormWrapperProps) => {
  const methods = useForm<FormData>({
    defaultValues: { path: '', ...defaultValues },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('PathField', () => {
  describe('Rendering', () => {
    it('should render with correct label and description', () => {
      render(
        <FormWrapper>
          <PathField />
        </FormWrapper>
      );

      expect(screen.getByText('Path')).toBeInTheDocument();
      expect(screen.getByText('File path inside the repository (.json or .yaml)')).toBeInTheDocument();
    });

    it('should render as an input with correct attributes', () => {
      render(
        <FormWrapper>
          <PathField />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveAttribute('id', 'dashboard-path');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should display initial value when provided', () => {
      const initialPath = 'dashboards/test-dashboard.json';
      render(
        <FormWrapper defaultValues={{ path: initialPath }}>
          <PathField />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue(initialPath);
    });
  });

  describe('ReadOnly State', () => {
    it('should be editable by default', () => {
      render(
        <FormWrapper>
          <PathField />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('readonly');
    });

    it('should be readonly when readOnly prop is true', () => {
      render(
        <FormWrapper>
          <PathField readOnly={true} />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('User Interactions', () => {
    it('should allow typing in the input', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <PathField />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      const testPath = 'dashboards/my-dashboard.json';

      await user.type(input, testPath);
      expect(input).toHaveValue(testPath);
    });

    it('should update form state when text is changed', async () => {
      const user = userEvent.setup();
      let formValues: FormData | undefined;

      const TestComponent = () => {
        const methods = useForm<FormData>({ defaultValues: { path: '' } });

        // Capture form values for assertion
        formValues = methods.watch();

        return (
          <FormProvider {...methods}>
            <PathField />
          </FormProvider>
        );
      };

      render(<TestComponent />);

      const input = screen.getByRole('textbox');
      const testPath = 'folder/dashboard.yaml';

      await user.type(input, testPath);
      expect(formValues?.path).toBe(testPath);
    });
  });

  describe('ReadOnly Behavior', () => {
    it('should prevent typing when readOnly is true', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper defaultValues={{ path: 'readonly-path.json' }}>
          <PathField readOnly={true} />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      const originalValue = 'readonly-path.json';

      expect(input).toHaveValue(originalValue);

      // Try to type in readonly input
      await user.type(input, 'should-not-work');
      expect(input).toHaveValue(originalValue); // Value should remain unchanged
    });
  });

  describe('Form Integration', () => {
    it('should work correctly with form submission', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      const TestForm = () => {
        const methods = useForm<FormData>({ defaultValues: { path: '' } });

        return (
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
              <PathField />
              <button type="submit">Submit</button>
            </form>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const input = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: 'Submit' });
      const testPath = 'submitted-dashboard.json';

      await user.type(input, testPath);
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith({ path: testPath }, expect.any(Object));
    });

    it('should reset value when form is reset', async () => {
      const TestForm = () => {
        const methods = useForm<FormData>({
          defaultValues: { path: 'initial-dashboard.json' },
        });

        return (
          <FormProvider {...methods}>
            <PathField />
            <button type="button" onClick={() => methods.reset()}>
              Reset
            </button>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const input = screen.getByRole('textbox');
      const resetButton = screen.getByRole('button', { name: 'Reset' });

      expect(input).toHaveValue('initial-dashboard.json');

      // Change the value
      await userEvent.clear(input);
      await userEvent.type(input, 'changed-dashboard.json');
      expect(input).toHaveValue('changed-dashboard.json');

      // Reset the form
      await userEvent.click(resetButton);
      expect(input).toHaveValue('initial-dashboard.json');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined readOnly prop gracefully', () => {
      render(
        <FormWrapper>
          <PathField readOnly={undefined} />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('readonly');
    });

    it('should handle empty string value', () => {
      render(
        <FormWrapper defaultValues={{ path: '' }}>
          <PathField />
        </FormWrapper>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });
});
