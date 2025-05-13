import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ValuePicker } from './ValuePicker';

const mockOptions = [
  { label: 'Option 1', value: 'opt1' },
  { label: 'Option 2', value: 'opt2' },
  { label: 'Option 3', value: 'opt3' },
];

const mockOnChange = jest.fn();
const defaultProps = {
  label: 'Add Option',
  options: mockOptions,
  onChange: mockOnChange,
};

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

describe('ValuePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should switch to select view when button is clicked', async () => {
    const { user } = setup(<ValuePicker {...defaultProps} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should call onChange and switch back to button view when option is selected', async () => {
    const { user } = setup(<ValuePicker {...defaultProps} />);

    await user.click(screen.getByRole('button'));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(mockOnChange).toHaveBeenCalledWith(mockOptions[0]);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
