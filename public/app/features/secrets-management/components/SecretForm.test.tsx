import { render, screen, userEvent } from 'test/test-utils';

import { validateSecretDescription, validateSecretName, validateSecretValue } from '../utils';

import { SecretForm, SecretFormProps } from './SecretForm';

const defaultProps: Pick<SecretFormProps, 'onCancel' | 'onSubmit' | 'submitText'> = {
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  submitText: 'Create',
};

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');

  return {
    ...actual,
    validateSecretName: jest.fn(),
    validateSecretDescription: jest.fn(),
    validateSecretValue: jest.fn(),
  };
});

function renderSecretForm(props?: Partial<SecretFormProps>) {
  const mergedProps = { ...defaultProps, ...props };
  return render(<SecretForm {...mergedProps} />);
}

describe('SecretForm', () => {
  it('should render form', () => {
    renderSecretForm();
    expect(screen.getByText('Name *')).toBeInTheDocument();
    expect(screen.getByText('Description *')).toBeInTheDocument();
    expect(screen.getByText('Value *')).toBeInTheDocument();
    expect(screen.getByText('Decrypters')).toBeInTheDocument();
    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByText('Add label', { selector: 'button > span' })).toBeInTheDocument();
    expect(screen.getByText('Cancel', { selector: 'button > span' })).toBeInTheDocument();
    expect(screen.getByText(defaultProps.submitText, { selector: 'button > span' })).toBeInTheDocument();
  });

  it.each([
    ['Name *', 'secret-name-1', validateSecretName, HTMLInputElement],
    ['Description *', 'Secret description', validateSecretDescription, HTMLInputElement],
    ['Value *', 'secret-value!', validateSecretValue, HTMLTextAreaElement],
  ])(
    'should focus and validate input ("%s")',
    async (byText: string, value: string, validationFunction: Function, instanceOf?: any) => {
      renderSecretForm();
      // Clicking label should focus correct input
      await userEvent.click(screen.getByText(byText));
      const input = document.activeElement;
      expect(input).toBeInstanceOf(instanceOf);
      await userEvent.type(input!, value);
      expect(validationFunction).toHaveBeenCalledWith(value, expect.anything());
    }
  );
});
