import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type Action,
  ActionType,
  defaultActionConfig,
  HttpRequestMethod,
  type VariableSuggestion,
  VariableOrigin,
} from '@grafana/data';

import { ActionEditorModalContent } from './ActionEditorModalContent';

describe('ActionEditorModalContent', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const mockSuggestions: VariableSuggestion[] = [
    { value: '${var1}', label: 'Variable 1', origin: VariableOrigin.BuiltIn },
  ];
  const getSuggestions = () => mockSuggestions;

  const validAction: Action = {
    ...defaultActionConfig,
    title: 'My Action',
    type: ActionType.Fetch,
    [ActionType.Fetch]: {
      method: HttpRequestMethod.POST,
      url: 'https://api.example.com',
      body: '{}',
      queryParams: [],
      headers: [['Content-Type', 'application/json']],
    },
  };

  const buildInfinityAction = (datasourceUid: string): Action => ({
    ...validAction,
    type: ActionType.Infinity,
    [ActionType.Infinity]: {
      method: HttpRequestMethod.POST,
      url: 'https://api.example.com',
      body: '{}',
      queryParams: [],
      headers: [['Content-Type', 'application/json']],
      datasourceUid,
    },
  });

  const defaultProps = {
    action: validAction,
    index: 2,
    data: [],
    onSave: mockOnSave,
    onCancel: mockOnCancel,
    getSuggestions,
    showOneClick: false,
  };

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders the editor with Save and Cancel buttons', () => {
    render(<ActionEditorModalContent {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('passes the current action to ActionEditor and renders existing values', () => {
    render(<ActionEditorModalContent {...defaultProps} />);

    expect(screen.getByDisplayValue('My Action')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com')).toBeInTheDocument();
  });

  it('disables Save when the action title is empty', () => {
    const noTitleAction: Action = { ...validAction, title: '' };

    render(<ActionEditorModalContent {...defaultProps} action={noTitleAction} />);

    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
  });

  it('disables Save when the action title is only whitespace', () => {
    const whitespaceTitleAction: Action = { ...validAction, title: '   ' };

    render(<ActionEditorModalContent {...defaultProps} action={whitespaceTitleAction} />);

    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
  });

  it('disables Save when the URL is missing', () => {
    const noUrlAction: Action = {
      ...validAction,
      [ActionType.Fetch]: {
        ...validAction[ActionType.Fetch]!,
        url: '',
      },
    };

    render(<ActionEditorModalContent {...defaultProps} action={noUrlAction} />);

    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
  });

  it('disables Save when the Infinity datasourceUid is an empty string', () => {
    render(<ActionEditorModalContent {...defaultProps} action={buildInfinityAction('')} />);

    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
  });

  it('enables Save when the Infinity datasourceUid is set', () => {
    render(<ActionEditorModalContent {...defaultProps} action={buildInfinityAction('ds-uid')} />);

    expect(screen.getByRole('button', { name: /Save/i })).toBeEnabled();
  });

  it('calls onSave with the current action and index when Save is clicked', async () => {
    const user = userEvent.setup();
    render(<ActionEditorModalContent {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(2, validAction);
  });

  it('calls onCancel with the index when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ActionEditorModalContent {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).toHaveBeenCalledWith(2);
  });

  it('saves edits to the action made through the editor', async () => {
    const user = userEvent.setup();
    render(<ActionEditorModalContent {...defaultProps} />);

    // Toggle method to GET via the radio group rendered by ActionEditor.
    await user.click(screen.getByRole('radio', { name: 'GET' }));
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(mockOnSave).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        title: 'My Action',
        type: ActionType.Fetch,
        [ActionType.Fetch]: expect.objectContaining({ method: HttpRequestMethod.GET }),
      })
    );
  });
});
