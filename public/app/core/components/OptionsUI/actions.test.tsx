import { render, screen } from '@testing-library/react';

import { VariableSuggestionsScope } from '@grafana/data';

jest.mock('app/features/actions/ActionsInlineEditor', () => ({
  ActionsInlineEditor: jest.fn(() => <div data-testid="actions-inline" />),
}));

import { ActionsValueEditor } from './actions';

const { ActionsInlineEditor } = jest.requireMock('app/features/actions/ActionsInlineEditor');

describe('ActionsValueEditor', () => {
  beforeEach(() => {
    jest.mocked(ActionsInlineEditor).mockClear();
  });

  it('passes actions, data, and suggestion scope to ActionsInlineEditor', () => {
    const getSuggestions = jest.fn(() => [{ label: 'a', value: 'b' }]);
    const onChange = jest.fn();
    const actions = [{ title: 'act', icon: 'bell' }];

    render(
      <ActionsValueEditor
        value={actions as Parameters<typeof ActionsValueEditor>[0]['value']}
        onChange={onChange}
        context={{ data: [], getSuggestions }}
      />
    );

    expect(screen.getByTestId('actions-inline')).toBeInTheDocument();

    expect(ActionsInlineEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        actions,
        data: [],
      }),
      expect.anything()
    );

    const getSuggestionsProp = ActionsInlineEditor.mock.calls[0][0].getSuggestions;
    expect(getSuggestionsProp()).toEqual([{ label: 'a', value: 'b' }]);
    expect(getSuggestions).toHaveBeenCalledWith(VariableSuggestionsScope.Values);
  });

  it('uses empty suggestions when context.getSuggestions is missing', () => {
    render(
      <ActionsValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} />
    );

    const getSuggestionsProp = ActionsInlineEditor.mock.calls[0][0].getSuggestions;
    expect(getSuggestionsProp()).toEqual([]);
  });
});
