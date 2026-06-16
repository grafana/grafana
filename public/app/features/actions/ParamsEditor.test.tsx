import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { type VariableSuggestion, VariableOrigin } from '@grafana/data';

import { ParamsEditor } from './ParamsEditor';

describe('ParamsEditor', () => {
  const mockOnChange = jest.fn();

  const mockSuggestions: VariableSuggestion[] = [
    { value: '${var1}', label: 'Variable 1', origin: VariableOrigin.BuiltIn },
  ];

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders empty state with disabled add button', () => {
    render(<ParamsEditor value={[]} onChange={mockOnChange} suggestions={mockSuggestions} />);

    expect(screen.getByPlaceholderText('Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('enables add button when both key and value are filled', async () => {
    const user = userEvent.setup();
    render(<ParamsEditor value={[]} onChange={mockOnChange} suggestions={mockSuggestions} />);

    const addButton = screen.getByRole('button', { name: 'Add' });
    expect(addButton).toBeDisabled();

    // SuggestionsInput propagates its value to the parent on blur, so tab out after typing.
    await user.type(screen.getByPlaceholderText('Key'), 'myKey');
    await user.tab();
    expect(addButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Value'), 'myValue');
    await user.tab();
    expect(addButton).toBeEnabled();
  });

  it('adds a new param when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<ParamsEditor value={[]} onChange={mockOnChange} suggestions={mockSuggestions} />);

    await user.type(screen.getByPlaceholderText('Key'), 'myKey');
    await user.type(screen.getByPlaceholderText('Value'), 'myValue');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockOnChange).toHaveBeenCalledWith([['myKey', 'myValue']]);
  });

  it('sorts params alphabetically when adding new ones', async () => {
    const user = userEvent.setup();
    const existing: Array<[string, string]> = [['zeta', 'last']];

    render(<ParamsEditor value={existing} onChange={mockOnChange} suggestions={mockSuggestions} />);

    await user.type(screen.getByPlaceholderText('Key'), 'alpha');
    await user.type(screen.getByPlaceholderText('Value'), 'first');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockOnChange).toHaveBeenCalledWith([
      ['alpha', 'first'],
      ['zeta', 'last'],
    ]);
  });

  it('replaces existing entry when adding a param with the same key', async () => {
    const user = userEvent.setup();
    const existing: Array<[string, string]> = [['key1', 'oldValue']];

    render(<ParamsEditor value={existing} onChange={mockOnChange} suggestions={mockSuggestions} />);

    await user.type(screen.getByPlaceholderText('Key'), 'key1');
    await user.type(screen.getByPlaceholderText('Value'), 'newValue');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(mockOnChange).toHaveBeenCalledWith([['key1', 'newValue']]);
  });

  it('removes an existing param when delete is clicked', async () => {
    const user = userEvent.setup();
    const existing: Array<[string, string]> = [
      ['keyA', 'valueA'],
      ['keyB', 'valueB'],
    ];

    render(<ParamsEditor value={existing} onChange={mockOnChange} suggestions={mockSuggestions} />);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    expect(deleteButtons).toHaveLength(2);

    await user.click(deleteButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith([['keyB', 'valueB']]);
  });

  it('does not render the Content-Type entry in the regular list', () => {
    const existing: Array<[string, string]> = [
      ['Content-Type', 'application/json'],
      ['Authorization', 'Bearer token'],
    ];

    render(<ParamsEditor value={existing} onChange={mockOnChange} suggestions={mockSuggestions} />);

    // Authorization is rendered as a disabled input in the list, Content-Type is not.
    expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Content-Type')).not.toBeInTheDocument();
  });

  it('renders the Content-Type selector when contentTypeHeader is true', () => {
    const existing: Array<[string, string]> = [['Content-Type', 'application/json']];

    render(
      <ParamsEditor value={existing} onChange={mockOnChange} suggestions={mockSuggestions} contentTypeHeader={true} />
    );

    expect(screen.getByDisplayValue('Content-Type')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('updates Content-Type via the dedicated selector', async () => {
    render(<ParamsEditor value={[]} onChange={mockOnChange} suggestions={mockSuggestions} contentTypeHeader={true} />);

    await selectOptionInTest(screen.getByRole('combobox'), 'application/json');

    expect(mockOnChange).toHaveBeenCalledWith([['Content-Type', 'application/json']]);
  });

  it('keeps disabled list inputs in sync with the value prop', () => {
    const existing: Array<[string, string]> = [['headerName', 'headerValue']];

    render(<ParamsEditor value={existing} onChange={mockOnChange} suggestions={mockSuggestions} />);

    const nameInput = screen.getByDisplayValue('headerName');
    const valueInput = screen.getByDisplayValue('headerValue');
    expect(nameInput).toBeDisabled();
    expect(valueInput).toBeDisabled();
  });

  it('resets the add button to disabled after a param is added', async () => {
    const user = userEvent.setup();
    render(<ParamsEditor value={[]} onChange={mockOnChange} suggestions={mockSuggestions} />);

    await user.type(screen.getByPlaceholderText('Key'), 'k');
    await user.type(screen.getByPlaceholderText('Value'), 'v');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    // The input row is remounted with cleared key/value state, so the add button is disabled again.
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});
