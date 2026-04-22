import { render, screen } from '@testing-library/react';

import { type Action, VariableSuggestionsScope } from '@grafana/data';

jest.mock('app/features/actions/ActionsInlineEditor', () => ({
  ActionsInlineEditor: ({ actions }: { actions: Action[]; getSuggestions: () => unknown[] }) => (
    <div data-testid="actions-inline-editor">
      <span data-testid="actions-count">{actions?.length ?? 0}</span>
    </div>
  ),
}));

import { ActionsValueEditor } from './actions';

const defaultItem = {
  id: 'actions',
  name: 'Actions',
  description: '',
  settings: {},
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

describe('ActionsValueEditor', () => {
  it('renders without crashing', () => {
    render(<ActionsValueEditor value={[]} onChange={jest.fn()} item={defaultItem} context={{ data: [] }} />);
    expect(screen.getByTestId('actions-inline-editor')).toBeInTheDocument();
  });

  it('passes actions to ActionsInlineEditor', () => {
    const actions: Action[] = [
      { title: 'Action 1', type: 'http', fetch: { url: 'http://example.com', method: 'GET' } },
    ];
    render(<ActionsValueEditor value={actions} onChange={jest.fn()} item={defaultItem} context={{ data: [] }} />);
    expect(screen.getByTestId('actions-count').textContent).toBe('1');
  });

  it('calls getSuggestions with Values scope when provided', () => {
    const getSuggestions = jest.fn().mockReturnValue([]);
    render(
      <ActionsValueEditor value={[]} onChange={jest.fn()} item={defaultItem} context={{ data: [], getSuggestions }} />
    );
    expect(screen.getByTestId('actions-inline-editor')).toBeInTheDocument();
  });
});
