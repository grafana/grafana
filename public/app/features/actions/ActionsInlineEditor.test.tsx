import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import {
  type Action,
  ActionType,
  defaultActionConfig,
  HttpRequestMethod,
  type VariableSuggestion,
  VariableOrigin,
} from '@grafana/data';

import { ActionsInlineEditor } from './ActionsInlineEditor';

const mockSuggestions: VariableSuggestion[] = [
  { value: '${var1}', label: 'Variable 1', origin: VariableOrigin.BuiltIn },
];

const buildFetchAction = (overrides: Partial<Action> = {}): Action => ({
  ...defaultActionConfig,
  title: 'Sample Action',
  type: ActionType.Fetch,
  [ActionType.Fetch]: {
    method: HttpRequestMethod.POST,
    url: 'https://api.example.com',
    body: '{}',
    queryParams: [],
    headers: [['Content-Type', 'application/json']],
  },
  ...overrides,
});

describe('ActionsInlineEditor', () => {
  const mockOnChange = jest.fn();
  const getSuggestions = () => mockSuggestions;

  const defaultProps = {
    actions: [] as Action[],
    onChange: mockOnChange,
    data: [],
    getSuggestions,
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders the add-action button with no actions', async () => {
    const { container } = render(<ActionsInlineEditor {...defaultProps} />);

    await waitFor(() => {
      expect(container.querySelector('[data-rfd-droppable-id="sortable-links"]')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Add action/i })).toBeInTheDocument();
    expect(screen.getByTestId('actions-inline')).toBeInTheDocument();
  });

  it('renders existing actions', async () => {
    const actions = [buildFetchAction({ title: 'First action' }), buildFetchAction({ title: 'Second action' })];

    const { container } = render(<ActionsInlineEditor {...defaultProps} actions={actions} />);

    await waitFor(() => {
      expect(container.querySelectorAll('[data-rfd-drag-handle-draggable-id]')).toHaveLength(2);
    });

    expect(screen.getByText('First action')).toBeInTheDocument();
    expect(screen.getByText('Second action')).toBeInTheDocument();
  });

  it('opens the modal with the Add action heading when Add is clicked', async () => {
    const user = userEvent.setup();
    render(<ActionsInlineEditor {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Add action/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Add action/i })).toBeInTheDocument();
    expect(await screen.findByPlaceholderText('Action title')).toHaveValue('');
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeDisabled();
  });

  it('opens the modal with the Edit action heading when an existing action is edited', async () => {
    const user = userEvent.setup();
    render(<ActionsInlineEditor {...defaultProps} actions={[buildFetchAction()]} />);

    await user.click(await screen.findByRole('button', { name: /edit/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Edit action/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Sample Action')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com')).toBeInTheDocument();
  });

  it('removes an action when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const actions = [buildFetchAction({ title: 'Keep me' }), buildFetchAction({ title: 'Remove me' })];

    render(<ActionsInlineEditor {...defaultProps} actions={actions} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[1]);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith([expect.objectContaining({ title: 'Keep me' })]);
  });

  it('passes showOneClick to the modal contents and surfaces the one-click switch', async () => {
    const user = userEvent.setup();
    render(<ActionsInlineEditor {...defaultProps} actions={[buildFetchAction()]} showOneClick={true} />);

    await user.click(await screen.findByRole('button', { name: /edit/i }));

    expect(await screen.findByRole('switch')).toBeInTheDocument();
  });

  it('hides the one-click switch when showOneClick is false', async () => {
    const user = userEvent.setup();
    render(<ActionsInlineEditor {...defaultProps} actions={[buildFetchAction()]} showOneClick={false} />);

    await user.click(await screen.findByRole('button', { name: /edit/i }));

    expect(await screen.findByRole('radio', { name: 'POST' })).toBeChecked();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('saves edits to an existing action through the modal', async () => {
    const user = userEvent.setup();
    const actions = [buildFetchAction({ title: 'Editable' })];

    render(<ActionsInlineEditor {...defaultProps} actions={actions} />);

    await user.click(await screen.findByRole('button', { name: /edit/i }));
    // Toggle method to GET inside the editor and save.
    await user.click(await screen.findByRole('radio', { name: 'GET' }));
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith([
      {
        ...actions[0],
        [ActionType.Fetch]: {
          method: HttpRequestMethod.GET,
          url: 'https://api.example.com',
          body: '{}',
          queryParams: [],
          headers: [['Content-Type', 'application/json']],
        },
      },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add action/i })).toBeInTheDocument();
  });

  it('discards edits on cancel and reopens with the saved action', async () => {
    const user = userEvent.setup();
    render(<ActionsInlineEditor {...defaultProps} actions={[buildFetchAction()]} />);

    await user.click(await screen.findByRole('button', { name: /edit/i }));
    expect(await screen.findByRole('radio', { name: 'POST' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'GET' }));
    expect(screen.getByRole('radio', { name: 'GET' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(screen.getByText('Sample Action')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add action/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockOnChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(await screen.findByRole('radio', { name: 'POST' })).toBeChecked();
  });
});
