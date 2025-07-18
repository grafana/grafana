import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActionVariableType } from '@grafana/data';

import { ActionVariablesEditor } from './ActionVariablesEditor';

describe('ActionVariablesEditor', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders empty state correctly', () => {
    render(<ActionVariablesEditor value={[]} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('enables add button when both key and name are filled', async () => {
    render(<ActionVariablesEditor value={[]} onChange={mockOnChange} />);

    const keyInput = screen.getByPlaceholderText('Key');
    const nameInput = screen.getByPlaceholderText('Name');
    const addButton = screen.getByRole('button', { name: 'Add' });

    expect(addButton).toBeDisabled();

    await userEvent.type(keyInput, 'testKey');
    await userEvent.type(nameInput, 'testName');

    expect(addButton).not.toBeDisabled();
  });

  it('adds a new variable when add button is clicked', async () => {
    render(<ActionVariablesEditor value={[]} onChange={mockOnChange} />);

    const keyInput = screen.getByPlaceholderText('Key');
    const nameInput = screen.getByPlaceholderText('Name');
    const addButton = screen.getByRole('button', { name: 'Add' });

    await userEvent.type(keyInput, 'testKey');
    await userEvent.type(nameInput, 'testName');
    await userEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith([
      {
        key: 'testKey',
        name: 'testName',
        type: ActionVariableType.String,
      },
    ]);

    expect(keyInput).toHaveValue('');
    expect(nameInput).toHaveValue('');
  });

  it('removes a variable when delete button is clicked', async () => {
    const existingVariables = [
      { key: 'key1', name: 'name1', type: ActionVariableType.String },
      { key: 'key2', name: 'name2', type: ActionVariableType.String },
    ];

    render(<ActionVariablesEditor value={existingVariables} onChange={mockOnChange} />);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([{ key: 'key2', name: 'name2', type: ActionVariableType.String }]);
  });

  it('sorts variables by key when adding new ones', async () => {
    const existingVariables = [{ key: 'key2', name: 'name2', type: ActionVariableType.String }];

    render(<ActionVariablesEditor value={existingVariables} onChange={mockOnChange} />);

    const keyInput = screen.getByPlaceholderText('Key');
    const nameInput = screen.getByPlaceholderText('Name');
    const addButton = screen.getByRole('button', { name: 'Add' });

    await userEvent.type(keyInput, 'key1');
    await userEvent.type(nameInput, 'name1');
    await userEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith([
      { key: 'key1', name: 'name1', type: ActionVariableType.String },
      { key: 'key2', name: 'name2', type: ActionVariableType.String },
    ]);
  });

  it('updates existing variable when adding with same key', async () => {
    const existingVariables = [{ key: 'key1', name: 'oldName', type: ActionVariableType.String }];

    render(<ActionVariablesEditor value={existingVariables} onChange={mockOnChange} />);

    const keyInput = screen.getByPlaceholderText('Key');
    const nameInput = screen.getByPlaceholderText('Name');
    const addButton = screen.getByRole('button', { name: 'Add' });

    await userEvent.type(keyInput, 'key1');
    await userEvent.type(nameInput, 'newName');
    await userEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith([{ key: 'key1', name: 'newName', type: ActionVariableType.String }]);
  });
});
