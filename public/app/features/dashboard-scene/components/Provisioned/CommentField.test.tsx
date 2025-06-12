import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { CommentField } from './CommentField';

// Mock the i18n hook since it's used in the component
jest.mock('@grafana/i18n', () => ({
  useTranslate: () => ({
    t: (_: string, defaultValue: string) => defaultValue,
  }),
}));

interface FormData {
  comment: string;
}

interface FormWrapperProps {
  children: ReactNode;
  defaultValues?: Partial<FormData>;
}

const FormWrapper = ({ children, defaultValues = {} }: FormWrapperProps) => {
  const methods = useForm<FormData>({
    defaultValues: { comment: '', ...defaultValues },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('CommentField', () => {
  describe('Rendering', () => {
    it('should render with correct label and placeholder', () => {
      render(
        <FormWrapper>
          <CommentField />
        </FormWrapper>
      );

      expect(screen.getByText('Comment')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add a note to describe your changes (optional)')).toBeInTheDocument();
    });

    it('should render as a textarea with correct attributes', () => {
      render(
        <FormWrapper>
          <CommentField />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).toHaveAttribute('id', 'dashboard-comment');
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('should display initial value when provided', () => {
      const initialComment = 'Initial comment text';
      render(
        <FormWrapper defaultValues={{ comment: initialComment }}>
          <CommentField />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(initialComment);
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(
        <FormWrapper>
          <CommentField disabled={true} />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('should allow typing in the textarea', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <CommentField />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox');
      const testComment = 'This is a test comment';

      await user.type(textarea, testComment);
      expect(textarea).toHaveValue(testComment);
    });

    it('should update form state when text is changed', async () => {
      const user = userEvent.setup();
      let formValues: FormData | undefined;

      const TestComponent = () => {
        const methods = useForm<FormData>({ defaultValues: { comment: '' } });

        // Capture form values for assertion
        formValues = methods.watch();

        return (
          <FormProvider {...methods}>
            <CommentField />
          </FormProvider>
        );
      };

      render(<TestComponent />);

      const textarea = screen.getByRole('textbox');
      const testComment = 'New comment';

      await user.type(textarea, testComment);
      expect(formValues?.comment).toBe(testComment);
    });

    it('should not allow typing when disabled', async () => {
      const user = userEvent.setup();

      render(
        <FormWrapper>
          <CommentField disabled={true} />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox');

      // Try to type in disabled textarea
      await user.type(textarea, 'Should not work');
      expect(textarea).toHaveValue('');
    });
  });

  describe('Form Integration', () => {
    it('should work correctly with form submission', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();

      const TestForm = () => {
        const methods = useForm<FormData>({ defaultValues: { comment: '' } });

        return (
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
              <CommentField />
              <button type="submit">Submit</button>
            </form>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: 'Submit' });
      const testComment = 'Form test comment';

      await user.type(textarea, testComment);
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith({ comment: testComment }, expect.any(Object));
    });

    it('should reset value when form is reset', async () => {
      const TestForm = () => {
        const methods = useForm<FormData>({
          defaultValues: { comment: 'Initial value' },
        });

        return (
          <FormProvider {...methods}>
            <CommentField />
            <button type="button" onClick={() => methods.reset()}>
              Reset
            </button>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const textarea = screen.getByRole('textbox');
      const resetButton = screen.getByRole('button', { name: 'Reset' });

      expect(textarea).toHaveValue('Initial value');

      // Change the value
      await userEvent.type(textarea, ' - changed');
      expect(textarea).toHaveValue('Initial value - changed');

      // Reset the form
      await userEvent.click(resetButton);
      expect(textarea).toHaveValue('Initial value');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined disabled prop gracefully', () => {
      render(
        <FormWrapper>
          <CommentField disabled={undefined} />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });

    it('should handle empty string value', () => {
      render(
        <FormWrapper defaultValues={{ comment: '' }}>
          <CommentField />
        </FormWrapper>
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });
  });
});
