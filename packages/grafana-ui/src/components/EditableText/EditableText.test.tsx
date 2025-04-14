import { render, screen, fireEvent } from '@testing-library/react';

import { EditableText } from './EditableText';

const mockOnChange = jest.fn();
describe('EditableText', () => {
  it('renders as text when editable is false', async () => {
    render(<EditableText text="Editable Text" editable={false} textChangeHandler={mockOnChange} />);

    expect(screen.getByText('Editable Text')).toBeInTheDocument();
    expect(await screen.queryByRole('input')).not.toBeInTheDocument();
  });

  it('renders as an input when editable is true', () => {
    render(<EditableText text="Editable Text" editable={true} textChangeHandler={mockOnChange} />);

    const input: HTMLInputElement = screen.getByTestId('editable-text-input');

    expect(input.value).toBe('Editable Text');
  });

  it('triggers the textChangeHandler when the input is changed', async () => {
    render(<EditableText text="Editable Text" editable={true} textChangeHandler={mockOnChange} />);

    const input: HTMLInputElement = screen.getByTestId('editable-text-input');

    await fireEvent.change(input, { target: { value: 'New Text' } });
    expect(mockOnChange).toHaveBeenCalledWith('New Text');
  });

  it('retains modified text after input change and editable is set to false', async () => {
    const { rerender } = render(<EditableText text="Editable Text" editable={true} textChangeHandler={mockOnChange} />);

    const input: HTMLInputElement = screen.getByTestId('editable-text-input');

    await fireEvent.change(input, { target: { value: 'New Text' } });
    rerender(<EditableText text="Editable Text" editable={false} textChangeHandler={mockOnChange} />);

    expect(screen.getByText('New Text')).toBeInTheDocument();
    expect(input).not.toBeInTheDocument();
  });
});
