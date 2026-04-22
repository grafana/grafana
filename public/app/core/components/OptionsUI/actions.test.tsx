import { render, screen } from '@testing-library/react';

import {
  ActionType,
  HttpRequestMethod,
  VariableOrigin,
  VariableSuggestionsScope,
  type Action,
} from '@grafana/data';

jest.mock('app/features/actions/ActionsInlineEditor', () => ({
  ActionsInlineEditor: jest.fn(() => <div data-testid="actions-inline" />),
}));

import { ActionsValueEditor } from './actions';

const { ActionsInlineEditor } = jest.requireMock('app/features/actions/ActionsInlineEditor');

const minimalAction: Action = {
  type: ActionType.Fetch,
  title: 'act',
  [ActionType.Fetch]: {
    method: HttpRequestMethod.GET,
    url: 'http://example.com',
  },
};

const editorItem = { id: 'actions-editor', name: 'Actions', settings: {} };

describe('ActionsValueEditor', () => {
  beforeEach(() => {
    jest.mocked(ActionsInlineEditor).mockClear();
  });

  it('passes actions, data, and suggestion scope to ActionsInlineEditor', () => {
    const getSuggestions = jest.fn(() => [{ label: 'a', value: 'b', origin: VariableOrigin.Value }]);
    const onChange = jest.fn();
    const actions = [minimalAction];

    render(
      <ActionsValueEditor
        value={actions}
        onChange={onChange}
        context={{ data: [], getSuggestions }}
        item={editorItem}
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
    expect(getSuggestionsProp()).toEqual([{ label: 'a', value: 'b', origin: VariableOrigin.Value }]);
    expect(getSuggestions).toHaveBeenCalledWith(VariableSuggestionsScope.Values);
  });

  it('uses empty suggestions when context.getSuggestions is missing', () => {
    render(<ActionsValueEditor value={[]} onChange={jest.fn()} context={{ data: [] }} item={editorItem} />);

    const getSuggestionsProp = ActionsInlineEditor.mock.calls[0][0].getSuggestions;
    expect(getSuggestionsProp()).toEqual([]);
  });
});
