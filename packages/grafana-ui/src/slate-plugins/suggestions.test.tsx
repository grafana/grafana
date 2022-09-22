import { render } from 'enzyme';
import _ from 'lodash'; // eslint-disable-line lodash/import-scope
import { Plugin as SlatePlugin } from 'slate-react';

import { CompletionItemGroup, SuggestionsState } from '../types';
import { SearchFunctionType } from '../utils';
import { SearchFunctionMap } from '../utils/searchFunctions';

import { SuggestionsPlugin } from './suggestions';

jest.spyOn(_, 'debounce').mockImplementation((func: (...args: any) => any) => {
  return Object.assign(func, { cancel: jest.fn(), flush: jest.fn() });
});

jest.mock('../utils/searchFunctions', () => ({
  // @ts-ignore
  ...jest.requireActual('../utils/searchFunctions'),
  SearchFunctionMap: {
    Prefix: jest.fn((items) => items),
    Word: jest.fn((items) => items),
    Fuzzy: jest.fn((items) => items),
  },
}));

const TypeaheadMock = jest.fn(() => '');
jest.mock('../components/Typeahead/Typeahead', () => {
  return {
    Typeahead: (state: Partial<SuggestionsState>) => {
      // @ts-ignore
      TypeaheadMock(state);
      return '';
    },
  };
});

describe('SuggestionsPlugin', () => {
  let plugin: SlatePlugin, nextMock: any, suggestions: CompletionItemGroup[], editorMock: any, eventMock: any;

  beforeEach(() => {
    let onTypeahead = async () => {
      return {
        suggestions: suggestions,
      };
    };

    (SearchFunctionMap.Prefix as jest.Mock).mockClear();
    (SearchFunctionMap.Word as jest.Mock).mockClear();
    (SearchFunctionMap.Fuzzy as jest.Mock).mockClear();

    plugin = SuggestionsPlugin({ portalOrigin: '', onTypeahead });
    nextMock = () => {};
    editorMock = createEditorMock('foo');
    eventMock = new window.KeyboardEvent('keydown', { key: 'a' });
  });

  async function triggerAutocomplete() {
    await plugin.onKeyDown!(eventMock, editorMock, nextMock);
    render(plugin.renderEditor!({} as any, editorMock, nextMock));
  }

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

    await triggerAutocomplete();

    expect(SearchFunctionMap.Word).not.toBeCalled();
    expect(SearchFunctionMap.Fuzzy).not.toBeCalled();
    expect(SearchFunctionMap.Prefix).toBeCalled();

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

    await triggerAutocomplete();

    expect(SearchFunctionMap.Word).not.toBeCalled();
    expect(SearchFunctionMap.Prefix).not.toBeCalled();
    expect(SearchFunctionMap.Fuzzy).toBeCalled();

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
    blur: jest.fn().mockReturnThis(),
    focus: jest.fn().mockReturnThis(),
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
