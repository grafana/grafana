import { render, screen } from '@testing-library/react';

import { ActionType, HttpRequestMethod, type Action } from '@grafana/data';

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

  it('renders without crashing when context.getSuggestions is absent', () => {
    render(<ActionsValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    expect(screen.getByTestId('actions-inline')).toBeInTheDocument();
  });
});
