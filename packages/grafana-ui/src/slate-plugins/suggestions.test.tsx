const prefixSearchMock = jest.fn((x) => x);
const wordSearchMock = jest.fn((x) => x);
const fuzzySearchMock = jest.fn((x) => x);
jest.mock('../utils/searchFunctions', () => {
  let module = {
    ...jest.requireActual('../utils/searchFunctions'),
    SearchFunctionMap: {
      Prefix: prefixSearchMock,
      Word: wordSearchMock,
      Fuzzy: fuzzySearchMock,
    },
  };
  return module;
});

const TypeaheadMock = jest.fn((state) => '');
jest.mock('../components/Typeahead/Typeahead', () => {
  return {
    Typeahead: (state: Partial<SuggestionsState>) => {
      TypeaheadMock(state);
      return '';
    },
  };
});

jest.mock('lodash/debounce', () => {
  const fakeDebounce = (func: () => any, period: number) => func;
  return fakeDebounce;
});

import { render } from 'enzyme';
import { SuggestionsPlugin } from './suggestions';
import { Plugin as SlatePlugin } from '@grafana/slate-react';
import { SearchFunctionType } from '../utils';
import { CompletionItemGroup, SuggestionsState } from '../types';

declare global {
  interface Window {
    KeyboardEvent: any;
  }
}

describe('SuggestionsPlugin', () => {
  let plugin: SlatePlugin, nextMock: any, suggestions: CompletionItemGroup[], editorMock: any, eventMock: any;

  beforeEach(() => {
    let onTypeahead = async () => {
      return {
        suggestions: suggestions,
      };
    };

    prefixSearchMock.mockClear();
    wordSearchMock.mockClear();
    fuzzySearchMock.mockClear();
    TypeaheadMock.mockClear();

    plugin = SuggestionsPlugin({ portalOrigin: '', onTypeahead });
    nextMock = () => {};
    editorMock = createEditorMock('foo');
    eventMock = new window.KeyboardEvent('keydown', { key: 'a' });
  });

  it('is backward compatible with prefixMatch and sortText', async () => {
    suggestions = [
      {
        label: 'group',
        prefixMatch: true,
        items: [
          { label: 'foobar', sortText: '3' },
          { label: 'foobar', sortText: '1' },
          { label: 'foobar', sortText: '2' },
        ],
      },
    ];

    await plugin.onKeyDown!(eventMock, editorMock, nextMock);
    await render(plugin.renderEditor!({} as any, editorMock, nextMock));

    expect(wordSearchMock).not.toBeCalled();
    expect(fuzzySearchMock).not.toBeCalled();
    expect(prefixSearchMock).toBeCalled();
    expect(TypeaheadMock).toBeCalledWith(
      expect.objectContaining({
        groupedItems: [
          {
            label: 'group',
            prefixMatch: true,
            items: [
              { label: 'foobar', sortText: '1' },
              { label: 'foobar', sortText: '2' },
              { label: 'foobar', sortText: '3' },
            ],
          },
        ],
      })
    );
  });

  it('uses searchFunction to create autocomplete list and sortValue if defined', async () => {
    suggestions = [
      {
        label: 'group',
        searchFunctionType: SearchFunctionType.Fuzzy,
        items: [
          { label: 'foobar', sortValue: 3 },
          { label: 'foobar', sortValue: 1 },
          { label: 'foobar', sortValue: 2 },
        ],
      },
    ];

    await plugin.onKeyDown!(eventMock, editorMock, nextMock);
    await render(plugin.renderEditor!({} as any, editorMock, nextMock));

    expect(wordSearchMock).not.toBeCalled();
    expect(prefixSearchMock).not.toBeCalled();
    expect(fuzzySearchMock).toBeCalled();
    expect(TypeaheadMock).toBeCalledWith(
      expect.objectContaining({
        groupedItems: [
          {
            label: 'group',
            searchFunctionType: SearchFunctionType.Fuzzy,
            items: [
              { label: 'foobar', sortValue: 1 },
              { label: 'foobar', sortValue: 2 },
              { label: 'foobar', sortValue: 3 },
            ],
          },
        ],
      })
    );
  });
});

function createEditorMock(currentText: string) {
  return {
    blur: () => ({
      focus: () => {},
    }),
    value: {
      selection: {
        start: {
          offset: 0,
        },
        end: {
          offset: 0,
        },
        focus: {
          offset: currentText.length,
        },
      },
      document: {
        getClosestBlock: () => {},
      },
      focusText: {
        text: currentText,
      },
      focusBlock: {},
    },
  };
}
