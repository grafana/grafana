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

    expect(screen.getByRole('textbox', { name: 'Key' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('associates visible column labels with disabled variable inputs', () => {
    const existingVariables = [{ key: 'key1', name: 'name1', type: ActionVariableType.String }];

    render(<ActionVariablesEditor value={existingVariables} onChange={mockOnChange} />);

    const keyInputs = screen.getAllByRole('textbox', { name: 'Key' });
    const nameInputs = screen.getAllByRole('textbox', { name: 'Name' });
    const typeInputs = screen.getAllByRole('textbox', { name: 'Type' });

    expect(keyInputs).toHaveLength(2);
    expect(keyInputs[1]).toHaveValue('key1');
    expect(keyInputs[1]).toBeDisabled();

    expect(nameInputs).toHaveLength(2);
    expect(nameInputs[1]).toHaveValue('name1');
    expect(nameInputs[1]).toBeDisabled();

    expect(typeInputs).toHaveLength(1);
    expect(typeInputs[0]).toHaveValue(ActionVariableType.String);
    expect(typeInputs[0]).toBeDisabled();
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
