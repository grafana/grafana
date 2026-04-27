import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ActionType,
  HttpRequestMethod,
  type Action,
  VariableOrigin,
  VariableSuggestionsScope,
} from '@grafana/data/types';

import { ActionsValueEditor } from './actions';

const editorItem = { id: 'actions-editor', name: 'Actions', settings: {} };

const makeAction = (title: string): Action => ({
  type: ActionType.Fetch,
  title,
  [ActionType.Fetch]: { method: HttpRequestMethod.GET, url: 'http://example.com' },
});

describe('ActionsValueEditor', () => {
  it('renders the actions editor container and add button', () => {
    render(<ActionsValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    expect(screen.getByTestId('actions-inline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add action/i })).toBeInTheDocument();
  });

  it('displays existing action titles in the list', () => {
    render(
      <ActionsValueEditor
        value={[makeAction('Send Alert'), makeAction('Open Dashboard')]}
        onChange={jest.fn()}
        context={{ data: [] }}
        item={editorItem}
      />
    );

    expect(screen.getByText('Send Alert')).toBeInTheDocument();
    expect(screen.getByText('Open Dashboard')).toBeInTheDocument();
  });

  it('opens the add modal (without crashing) when context.getSuggestions is absent', async () => {
    render(<ActionsValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    await userEvent.click(screen.getByRole('button', { name: /add action/i }));

    expect(screen.getByRole('dialog', { name: /add action/i })).toBeInTheDocument();
  });

  it('opens the edit modal (without crashing) when context.getSuggestions is absent', async () => {
    render(
      <ActionsValueEditor
        value={[makeAction('Send Alert')]}
        onChange={jest.fn()}
        context={{ data: [] }}
        item={editorItem}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByRole('dialog', { name: /edit action/i })).toBeInTheDocument();
  });

  it('calls getSuggestions with Values scope when the add modal opens', async () => {
    const suggestions = [{ value: '${__value.text}', label: 'Value', origin: VariableOrigin.Value }];
    const getSuggestions = jest.fn().mockReturnValue(suggestions);

    render(
      <ActionsValueEditor value={[]} onChange={jest.fn()} context={{ data: [], getSuggestions }} item={editorItem} />
    );

    await userEvent.click(screen.getByRole('button', { name: /add action/i }));

    expect(screen.getByRole('dialog', { name: /add action/i })).toBeInTheDocument();
    expect(getSuggestions).toHaveBeenCalledWith(VariableSuggestionsScope.Values);
  });

  it('calls getSuggestions with Values scope when the edit modal opens', async () => {
    const suggestions = [{ value: '${__value.text}', label: 'Value', origin: VariableOrigin.Value }];
    const getSuggestions = jest.fn().mockReturnValue(suggestions);

    render(
      <ActionsValueEditor
        value={[makeAction('Send Alert')]}
        onChange={jest.fn()}
        context={{ data: [], getSuggestions }}
        item={editorItem}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByRole('dialog', { name: /edit action/i })).toBeInTheDocument();
    expect(getSuggestions).toHaveBeenCalledWith(VariableSuggestionsScope.Values);
  });
});
