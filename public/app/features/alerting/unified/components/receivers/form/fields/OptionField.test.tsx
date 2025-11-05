import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { NotificationChannelOption, NotificationChannelSecureFields ,OptionMeta} from 'app/types';

import { OptionField } from './OptionField';

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm();
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const renderOptionField = (
  option: NotificationChannelOption,
  props: {
    getOptionMeta?: (option: NotificationChannelOption) => OptionMeta;
    readOnly?: boolean;
    secureFields?: NotificationChannelSecureFields;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValue?: any;
  } = {}
) => {
  const defaultProps = {
    option,
    defaultValue: '',
    pathPrefix: 'test.',
    secureFields: {},
    ...props,
  };

  return render(
    <TestWrapper>
      <OptionField {...defaultProps} />
    </TestWrapper>
  );
};

describe('OptionField', () => {
  describe('Protected field indicator', () => {
    it('should display lock icon with tooltip when field is protected and readOnly', async () => {
      const option: NotificationChannelOption = {
        propertyName: 'testField',
        label: 'Test Field',
        description: 'A test field',
        element: 'input',
        inputType: 'text',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: true,
        dependsOn: '',
      };

      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: true, required: false });

      renderOptionField(option, { getOptionMeta });

      // Check that lock icon is displayed
      const lockIcon = screen.getByTestId('lock-icon');
      expect(lockIcon).toBeInTheDocument();

      // Hover over the icon to show tooltip
      await userEvent.hover(lockIcon);

      // Check that tooltip appears with correct text
      await waitFor(() => {
        expect(
          screen.getByText('This field is protected and can only be edited by users with elevated permissions')
        ).toBeInTheDocument();
      });
    });

    it('should NOT display lock icon when field is protected but NOT readOnly', () => {
      const option: NotificationChannelOption = {
        propertyName: 'testField',
        label: 'Test Field',
        description: 'A test field',
        element: 'input',
        inputType: 'text',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: true,
        dependsOn: '',
      };

      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: false, required: false });

      renderOptionField(option, { getOptionMeta });

      // Lock icon should not be displayed
      expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument();
    });

    it('should NOT display lock icon when field is NOT protected', () => {
      const option: NotificationChannelOption = {
        propertyName: 'testField',
        label: 'Test Field',
        description: 'A test field',
        element: 'input',
        inputType: 'text',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: false,
        dependsOn: '',
      };

      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: true, required: false });

      renderOptionField(option, { getOptionMeta });

      // Lock icon should not be displayed
      expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument();
    });

    it('should NOT display lock icon when getOptionMeta is not provided', () => {
      const option: NotificationChannelOption = {
        propertyName: 'testField',
        label: 'Test Field',
        description: 'A test field',
        element: 'input',
        inputType: 'text',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: true,
        dependsOn: '',
      };

      renderOptionField(option);

      // Lock icon should not be displayed
      expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument();
    });

    it('should display lock icon for checkbox fields when protected and readOnly', () => {
      const option: NotificationChannelOption = {
        propertyName: 'testCheckbox',
        label: 'Test Checkbox',
        description: 'A test checkbox',
        element: 'checkbox',
        inputType: '',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: true,
        dependsOn: '',
      };

      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: true, required: false });

      renderOptionField(option, { getOptionMeta });

      // Lock icon should be displayed even for checkbox
      const lockIcon = screen.getByTestId('lock-icon');
      expect(lockIcon).toBeInTheDocument();
    });

    it('should display lock icon for select fields when protected and readOnly', () => {
      const option: NotificationChannelOption = {
        propertyName: 'testSelect',
        label: 'Test Select',
        description: 'A test select',
        element: 'select',
        inputType: '',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: true,
        dependsOn: '',
        selectOptions: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ],
      };

      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: true, required: false });

      renderOptionField(option, { getOptionMeta });

      // Lock icon should be displayed
      const lockIcon = screen.getByTestId('lock-icon');
      expect(lockIcon).toBeInTheDocument();
    });
  });

  describe('Subform fields', () => {
    it('should pass getOptionMeta to SubformField component', () => {
      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: true, required: false });

      const option: NotificationChannelOption = {
        propertyName: 'testSubform',
        label: 'Test Subform',
        description: 'A test subform',
        element: 'subform',
        inputType: '',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: false,
        dependsOn: '',
        subformOptions: [
          {
            propertyName: 'nestedField',
            label: 'Nested Field',
            description: 'A nested field',
            element: 'input',
            inputType: 'text',
            placeholder: '',
            required: false,
            secure: false,
            showWhen: { field: '', is: '' },
            validationRule: '',
            protected: true,
            dependsOn: '',
          },
        ],
      };

      renderOptionField(option, { getOptionMeta, defaultValue: { nestedField: 'test' } });

      // The subform should be rendered with the nested field
      expect(screen.getByText('Test Subform')).toBeInTheDocument();
      
      // Verify that getOptionMeta was called for the nested field
      // This ensures it was passed through to the SubformField component
      expect(getOptionMeta).toHaveBeenCalled();
    });

    it('should display lock icon for protected fields inside subform when readOnly', async () => {
      const getOptionMeta = jest.fn((opt) => {
        // Make the nested protected field readOnly
        if (opt.protected) {
          return { readOnly: true, required: false };
        }
        return { readOnly: false, required: false };
      });

      const option: NotificationChannelOption = {
        propertyName: 'oauth2',
        label: 'OAuth2 Configuration',
        description: 'OAuth2 settings',
        element: 'subform',
        inputType: '',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: false,
        dependsOn: '',
        subformOptions: [
          {
            propertyName: 'token_url',
            label: 'Token URL',
            description: 'OAuth2 token URL',
            element: 'input',
            inputType: 'text',
            placeholder: '',
            required: false,
            secure: false,
            showWhen: { field: '', is: '' },
            validationRule: '',
            protected: true,
            dependsOn: '',
          },
        ],
      };

      renderOptionField(option, { getOptionMeta, defaultValue: { token_url: 'https://example.com/token' } });

      // Check that lock icon is displayed for the nested protected field
      const lockIcon = screen.getByTestId('lock-icon');
      expect(lockIcon).toBeInTheDocument();

      // Hover over the icon to show tooltip
      await userEvent.hover(lockIcon);

      // Check that tooltip appears
      await waitFor(() => {
        expect(
          screen.getByText('This field is protected and can only be edited by users with elevated permissions')
        ).toBeInTheDocument();
      });
    });

    it('should NOT display lock icon for protected fields inside subform when user can edit', () => {
      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: false, required: false });

      const option: NotificationChannelOption = {
        propertyName: 'oauth2',
        label: 'OAuth2 Configuration',
        description: 'OAuth2 settings',
        element: 'subform',
        inputType: '',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: false,
        dependsOn: '',
        subformOptions: [
          {
            propertyName: 'token_url',
            label: 'Token URL',
            description: 'OAuth2 token URL',
            element: 'input',
            inputType: 'text',
            placeholder: '',
            required: false,
            secure: false,
            showWhen: { field: '', is: '' },
            validationRule: '',
            protected: true,
            dependsOn: '',
          },
        ],
      };

      renderOptionField(option, { getOptionMeta, defaultValue: { token_url: 'https://example.com/token' } });

      // Lock icon should not be displayed when user has permission
      expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument();
    });
  });

  describe('Subform array fields', () => {
    it('should pass getOptionMeta to SubformArrayField component', () => {
      const getOptionMeta = jest.fn().mockReturnValue({ readOnly: true, required: false });

      const option: NotificationChannelOption = {
        propertyName: 'testSubformArray',
        label: 'Test Subform Array',
        description: 'A test subform array',
        element: 'subform_array',
        inputType: '',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: false,
        dependsOn: '',
        subformOptions: [
          {
            propertyName: 'nestedField',
            label: 'Nested Field',
            description: 'A nested field',
            element: 'input',
            inputType: 'text',
            placeholder: '',
            required: false,
            secure: false,
            showWhen: { field: '', is: '' },
            validationRule: '',
            protected: true,
            dependsOn: '',
          },
        ],
      };

      renderOptionField(option, { getOptionMeta, defaultValue: [{ nestedField: 'test' }] });

      // The subform array should be rendered
      expect(screen.getByText('Test Subform Array (1)')).toBeInTheDocument();
      
      // Verify that getOptionMeta was called
      expect(getOptionMeta).toHaveBeenCalled();
    });

    it('should display lock icon for protected fields inside subform array when readOnly', async () => {
      const getOptionMeta = jest.fn((opt) => {
        if (opt.protected) {
          return { readOnly: true, required: false };
        }
        return { readOnly: false, required: false };
      });

      const option: NotificationChannelOption = {
        propertyName: 'headers',
        label: 'HTTP Headers',
        description: 'Custom headers',
        element: 'subform_array',
        inputType: '',
        placeholder: '',
        required: false,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        protected: false,
        dependsOn: '',
        subformOptions: [
          {
            propertyName: 'authorization',
            label: 'Authorization Header',
            description: 'Auth header value',
            element: 'input',
            inputType: 'text',
            placeholder: '',
            required: false,
            secure: false,
            showWhen: { field: '', is: '' },
            validationRule: '',
            protected: true,
            dependsOn: '',
          },
        ],
      };

      renderOptionField(option, { getOptionMeta, defaultValue: [{ authorization: 'Bearer token' }] });

      // Check that lock icon is displayed for the nested protected field
      const lockIcon = screen.getByTestId('lock-icon');
      expect(lockIcon).toBeInTheDocument();

      // Hover over the icon to show tooltip
      await userEvent.hover(lockIcon);

      // Check that tooltip appears
      await waitFor(() => {
        expect(
          screen.getByText('This field is protected and can only be edited by users with elevated permissions')
        ).toBeInTheDocument();
      });
    });
  });
});
