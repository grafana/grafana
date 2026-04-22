import { render, screen } from '@testing-library/react';

import { VariableOrigin, VariableSuggestionsScope } from '@grafana/data';

import { DataLinksValueEditor } from './links';

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    DataLinksInlineEditor: jest.fn(() => <div data-testid="links-inline" />),
  };
});

const { DataLinksInlineEditor } = jest.requireMock('@grafana/ui');

describe('DataLinksValueEditor', () => {
  beforeEach(() => {
    jest.mocked(DataLinksInlineEditor).mockClear();
  });

  it('passes links, data, showOneClick, and suggestion scope to DataLinksInlineEditor', () => {
    const getSuggestions = jest.fn(() => [{ label: 's', value: 'v', origin: VariableOrigin.Value }]);
    const onChange = jest.fn();
    const links = [{ title: 't', url: 'u' }];

    render(
      <DataLinksValueEditor
        value={links as Parameters<typeof DataLinksValueEditor>[0]['value']}
        onChange={onChange}
        context={{ data: [], getSuggestions }}
        item={{ settings: { showOneClick: true } } as Parameters<typeof DataLinksValueEditor>[0]['item']}
      />
    );

    expect(screen.getByTestId('links-inline')).toBeInTheDocument();

    expect(DataLinksInlineEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        links,
        data: [],
        showOneClick: true,
      }),
      expect.anything()
    );

    const getSuggestionsProp = DataLinksInlineEditor.mock.calls[0][0].getSuggestions;
    expect(typeof getSuggestionsProp).toBe('function');
    expect(getSuggestionsProp()).toEqual([{ label: 's', value: 'v', origin: VariableOrigin.Value }]);
    expect(getSuggestions).toHaveBeenCalledWith(VariableSuggestionsScope.Values);
  });

  it('uses empty suggestions when context.getSuggestions is missing', () => {
    render(
      <DataLinksValueEditor
        value={[]}
        onChange={jest.fn()}
        context={{ data: [] }}
        item={{ settings: {} } as Parameters<typeof DataLinksValueEditor>[0]['item']}
      />
    );

    const getSuggestionsProp = DataLinksInlineEditor.mock.calls[0][0].getSuggestions;
    expect(getSuggestionsProp()).toEqual([]);
  });
});
