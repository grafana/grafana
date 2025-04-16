import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EditableText } from './EditableText';

const NEW_TEXT = 'New Text';

const mockOnChange = jest.fn();
describe('EditableText', () => {
  it('renders as text when editable is false', async () => {
    render(<EditableText value="Editable Text" isEditing={false} onChange={mockOnChange} />);

    expect(screen.getByText('Editable Text')).toBeInTheDocument();
    expect(await screen.queryByRole('input')).not.toBeInTheDocument();
  });

  it('renders as an input when editable is true', () => {
    render(<EditableText value="Editable Text" isEditing={true} onChange={mockOnChange} />);

    const input: HTMLInputElement = screen.getByRole('textbox');

    expect(input.value).toBe('Editable Text');
  });

  it('triggers the textChangeHandler when the input is changed', async () => {
    render(<EditableText value="Editable Text" isEditing={true} onChange={mockOnChange} />);

    const input: HTMLInputElement = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, NEW_TEXT);

    expect(mockOnChange).toHaveBeenCalledTimes(NEW_TEXT.length + 1);
  });
});
