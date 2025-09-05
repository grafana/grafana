import { dateTime, TimeRange } from '@grafana/data';
import type { Monaco, monacoTypes } from '@grafana/ui';

import { DataProvider } from './data_provider';
import { getCompletionProvider, getSuggestOptions } from './monaco-completion-provider';

// Mock the dependencies
jest.mock('./completions');
jest.mock('./situation');

const mockGetCompletions = jest.fn();
const mockGetSituation = jest.fn();

jest.mock('./completions', () => ({
  getCompletions: (...args: Parameters<typeof mockGetCompletions>) => mockGetCompletions(...args),
}));

jest.mock('./situation', () => ({
  getSituation: (...args: Parameters<typeof mockGetSituation>) => mockGetSituation(...args),
}));

// Create proper Monaco mocks without 'any'
const createMockMonaco = (): Monaco => {
  const mockRange = {
    lift: jest.fn((range: monacoTypes.IRange) => range),
    fromPositions: jest.fn((position: monacoTypes.Position) => ({
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: position.column,
      endColumn: position.column,
    })),
  };

  return {
    languages: {
      CompletionItemKind: {
        Unit: 0,
        Variable: 1,
        Snippet: 2,
        Enum: 3,
        EnumMember: 4,
        Constructor: 5,
      } as const,
    },
    Range: mockRange,
  } as unknown as Monaco;
};

const createMockModel = (
  value: string,
  mockWord: monacoTypes.editor.IWordAtPosition | null = null
): monacoTypes.editor.ITextModel => {
  return {
    getValue: () => value,
    getValueInRange: jest.fn((range: monacoTypes.IRange) => {
      // Convert to 0-based indexing
      const startIndex = Math.max(0, range.startColumn - 1);
      const endIndex = Math.min(value.length, range.endColumn - 1);
      return value.substring(startIndex, endIndex);
    }),
    getWordAtPosition: jest.fn(() => mockWord),
    getOffsetAt: jest.fn((position: monacoTypes.Position) => position.column - 1),
    id: 'test-model',
  } as unknown as monacoTypes.editor.ITextModel;
};

const createMockPosition = (column: number, lineNumber = 1): monacoTypes.Position =>
  ({
    column,
    lineNumber,
  }) as monacoTypes.Position;

const createMockDataProvider = (): DataProvider => {
  return {
    monacoSettings: {
      setInputInRange: jest.fn(),
      suggestionsIncomplete: false,
    },
  } as unknown as DataProvider;
};

const createMockTimeRange = (): TimeRange => ({
  from: dateTime(Date.now() - 3600000), // 1 hour ago
  to: dateTime(Date.now()),
  raw: { from: 'now-1h', to: 'now' },
});

describe('monaco-completion-provider', () => {
  let monaco: Monaco;
  let dataProvider: DataProvider;
  let timeRange: TimeRange;

  beforeEach(() => {
    monaco = createMockMonaco();
    dataProvider = createMockDataProvider();
    timeRange = createMockTimeRange();

    // Reset mocks
    jest.clearAllMocks();
    mockGetCompletions.mockResolvedValue([]);
    mockGetSituation.mockReturnValue({ type: 'METRIC_NAME' });

    // Mock window.getSelection
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: jest.fn(() => ({
        toString: () => '',
      })),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSuggestOptions', () => {
    it('should return options with showWords set to false', () => {
      const options = getSuggestOptions();
      expect(options).toEqual({
        showWords: false,
      });
    });
  });

  describe('getCompletionProvider', () => {
    it('should return provider and state objects', () => {
      const result = getCompletionProvider(monaco, dataProvider, timeRange);

      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('state');
      expect(result.state).toHaveProperty('isManualTriggerRequested', false);
      expect(result.provider).toHaveProperty('triggerCharacters');
      expect(result.provider).toHaveProperty('provideCompletionItems');
    });

    it('should have correct trigger characters', () => {
      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      expect(provider.triggerCharacters).toEqual(['{', ',', '[', '(', '=', '~', ' ', '"']);
    });
  });

  describe('provideCompletionItems', () => {
    it('should return empty suggestions when no situation is detected', async () => {
      mockGetSituation.mockReturnValue(null);

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);
      const model = createMockModel('test');
      const position = createMockPosition(4);

      const result = await (provider.provideCompletionItems as Function)(model, position);

      expect(result).toEqual({
        suggestions: [],
        incomplete: false,
      });
    });

    it('should call getCompletions with correct parameters for normal word', async () => {
      const mockWord = { word: 'grafana', startColumn: 1, endColumn: 7 };
      const model = createMockModel('grafana', mockWord);
      const position = createMockPosition(7);

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      await (provider.provideCompletionItems as Function)(model, position);

      expect(mockGetCompletions).toHaveBeenCalledWith(
        { type: 'METRIC_NAME' },
        dataProvider,
        timeRange,
        'grafana',
        'full' // Should be 'full' because word length >= 3
      );
    });

    it('should use partial trigger type for short words', async () => {
      const mockWord = { word: 'go', startColumn: 1, endColumn: 3 };
      const model = createMockModel('go', mockWord);
      const position = createMockPosition(3);

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      await (provider.provideCompletionItems as Function)(model, position);

      expect(mockGetCompletions).toHaveBeenCalledWith(
        { type: 'METRIC_NAME' },
        dataProvider,
        timeRange,
        'go',
        'partial' // Should be 'partial' because word length < 3
      );
    });

    it('should format completion items correctly', async () => {
      const mockCompletions = [
        {
          label: 'test_metric',
          detail: 'A test metric',
          insertText: 'test_metric',
          documentation: 'Test documentation',
          insertTextRules: undefined,
          type: 'METRIC_NAME' as const,
          triggerOnInsert: false,
        },
      ];

      mockGetCompletions.mockResolvedValue(mockCompletions);

      const mockWord = { word: 'test', startColumn: 1, endColumn: 5 };
      const model = createMockModel('test', mockWord);
      const position = createMockPosition(5);

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      const result = await (provider.provideCompletionItems as Function)(model, position);

      expect(result?.suggestions).toHaveLength(1);
      expect(result?.suggestions?.[0]).toMatchObject({
        label: 'test_metric',
        detail: 'A test metric',
        insertText: 'test_metric',
        documentation: 'Test documentation',
        kind: 5, // Constructor kind for METRIC_NAME
        sortText: '0',
        command: undefined,
      });
    });

    it('should add trigger command for items with triggerOnInsert', async () => {
      const mockCompletions = [
        {
          label: 'func(',
          insertText: 'func(',
          type: 'FUNCTION' as const,
          triggerOnInsert: true,
        },
      ];

      mockGetCompletions.mockResolvedValue(mockCompletions);

      const model = createMockModel('func');
      const position = createMockPosition(4);

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      const result = await (provider.provideCompletionItems as Function)(model, position);

      expect(result?.suggestions?.[0]?.command).toEqual({
        id: 'editor.action.triggerSuggest',
        title: '',
      });
    });
  });

  describe('manual trigger handling', () => {
    it('should use full trigger type for manual trigger', async () => {
      const mockWord = { word: 'te', startColumn: 1, endColumn: 3 };
      const model = createMockModel('te', mockWord);
      const position = createMockPosition(3);

      const { provider, state } = getCompletionProvider(monaco, dataProvider, timeRange);

      // Set manual trigger flag
      state.isManualTriggerRequested = true;

      await (provider.provideCompletionItems as Function)(model, position);

      expect(mockGetCompletions).toHaveBeenCalledWith(
        { type: 'METRIC_NAME' },
        dataProvider,
        timeRange,
        'te',
        'full' // Should be 'full' despite short word length
      );
    });
  });

  describe('trigger character handling', () => {
    const triggerCharacters = ['{', ',', '[', '(', '=', '~', ' ', '"'];

    triggerCharacters.forEach((triggerChar) => {
      it(`should use full trigger type for trigger character "${triggerChar}"`, async () => {
        const testString = `grafana${triggerChar}`;
        const model = createMockModel(testString, null);
        const position = createMockPosition(testString.length + 1); // After trigger character (1-indexed)

        const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

        await (provider.provideCompletionItems as Function)(model, position);

        expect(mockGetCompletions).toHaveBeenCalledWith(
          { type: 'METRIC_NAME' },
          dataProvider,
          timeRange,
          undefined, // No word at position after trigger char
          'full'
        );
      });
    });

    it('should handle trigger character at beginning of line', async () => {
      const model = createMockModel('{', null);
      const position = createMockPosition(2); // After the { character

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      await (provider.provideCompletionItems as Function)(model, position);

      // Should not fail and should still call getCompletions
      expect(mockGetCompletions).toHaveBeenCalled();
    });
  });

  describe('selection handling', () => {
    it('should adjust cursor position when text is selected', async () => {
      // Mock selected text
      Object.defineProperty(window, 'getSelection', {
        writable: true,
        value: jest.fn(() => ({
          toString: () => 'selected',
        })),
      });

      const model = createMockModel('grafana selected');
      const position = createMockPosition(16); // End of string

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      await (provider.provideCompletionItems as Function)(model, position);

      // Should call getOffsetAt with adjusted position
      expect(model.getOffsetAt).toHaveBeenCalledWith({
        column: 8, // 16 - 8 (length of 'selected')
        lineNumber: 1,
      });
    });
  });

  describe('data provider integration', () => {
    it('should set input range on data provider', async () => {
      const mockWord = { word: 'test', startColumn: 1, endColumn: 5 };
      const model = createMockModel('test', mockWord);
      const position = createMockPosition(5);

      const { provider } = getCompletionProvider(monaco, dataProvider, timeRange);

      await (provider.provideCompletionItems as Function)(model, position);

      expect(dataProvider.monacoSettings.setInputInRange).toHaveBeenCalled();
    });
  });
});
