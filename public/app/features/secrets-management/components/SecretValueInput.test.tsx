import { render, screen, userEvent } from 'test/test-utils';

import { SecretValueInput } from './SecretValueInput';

const ELEMENT_ID = 'ELEMENT_ID';
const ELEMENT_VALUE = 'ELEMENT_VALUE';

const handleOnChange = jest.fn();
const handleReset = jest.fn();

function getDefaultProps(isConfigured = false, value = ELEMENT_VALUE) {
  return {
    id: ELEMENT_ID,
    onReset: handleReset,
    onChange: handleOnChange,
    value,
    isConfigured,
  };
}

describe('SecretValueInput', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render textarea when not configured', async () => {
    const props = getDefaultProps(false);
    render(<SecretValueInput {...props} />);

    const elementWithValue = screen.getByText(ELEMENT_VALUE);
    expect(elementWithValue.tagName).toBe('TEXTAREA');
    await userEvent.type(elementWithValue, ELEMENT_VALUE);
    expect(handleOnChange).toHaveBeenCalledTimes(ELEMENT_VALUE.length);
  });

  it('should render input and reset button when configured', async () => {
    const props = getDefaultProps(true);
    render(<SecretValueInput {...props} />);

    // Check that the value is not present
    const elementWithValue = screen.queryByText(ELEMENT_VALUE);
    expect(elementWithValue).not.toBeInTheDocument();

    const inputElement = screen.getByDisplayValue('configured');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement.tagName).toBe('INPUT');
    expect(inputElement).toBeDisabled();

    const resetButtonElement = screen.getByText('Reset');
    expect(resetButtonElement).toBeInTheDocument();
    await userEvent.click(resetButtonElement);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
