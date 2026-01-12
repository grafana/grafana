import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import { DataLinkBuiltInVars, VariableOrigin, VariableSuggestion } from '@grafana/data';

import { dataLinkAutocompletion } from './codemirrorUtils';

describe('dataLinkAutocompletion', () => {
  const mockSuggestions: VariableSuggestion[] = [
    {
      value: DataLinkBuiltInVars.seriesName,
      label: '__series.name',
      documentation: 'Series name',
      origin: VariableOrigin.Series,
    },
    {
      value: DataLinkBuiltInVars.fieldName,
      label: '__field.name',
      documentation: 'Field name',
      origin: VariableOrigin.Field,
    },
    {
      value: 'myVar',
      label: 'myVar',
      documentation: 'Custom variable',
      origin: VariableOrigin.Template,
    },
    {
      value: DataLinkBuiltInVars.includeVars,
      label: '__all_variables',
      documentation: 'Include all variables',
      origin: VariableOrigin.BuiltIn,
    },
  ];

  // Helper function to create a mock CompletionContext
  function createMockContext(text: string, pos: number, explicit = false): CompletionContext {
    const state = EditorState.create({ doc: text });

    return {
      state,
      pos,
      explicit,
      matchBefore: (regex: RegExp) => {
        const textBefore = text.slice(0, pos);
        const match = textBefore.match(regex);
        if (match) {
          return {
            from: pos - match[0].length,
            to: pos,
            text: match[0],
          };
        }
        return null;
      },
      tokenBefore: jest.fn().mockReturnValue(null),
      aborted: false,
      addEventListener: jest.fn(),
    };
  }

  describe('with no suggestions', () => {
    it('should return null when suggestions array is empty', () => {
      const autocompletion = dataLinkAutocompletion([]);
      const context = createMockContext('$', 1);
      const result = autocompletion(context);

      expect(result).toBeNull();
    });
  });

  describe('explicit completion (Ctrl+Space)', () => {
    it('should show all suggestions at cursor position when triggered explicitly', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('https://grafana.com', 19, true);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(19);
      expect(result.options).toHaveLength(4);
    });

    it('should include proper labels and details for all suggestions', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('test', 4, true);
      const result = autocompletion(context) as CompletionResult;

      expect(result.options[0]).toMatchObject({
        label: '__series.name',
        detail: VariableOrigin.Series,
        info: 'Series name',
        type: 'variable',
      });
      expect(result.options[1]).toMatchObject({
        label: '__field.name',
        detail: VariableOrigin.Field,
        info: 'Field name',
        type: 'variable',
      });
    });

    it('should apply template variables with :queryparam suffix', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('test', 4, true);
      const result = autocompletion(context) as CompletionResult;

      const templateVar = result.options.find((opt) => opt.label === 'myVar');
      expect(templateVar?.apply).toBe('${myVar:queryparam}');
    });

    it('should apply non-template variables without :queryparam suffix', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('test', 4, true);
      const result = autocompletion(context) as CompletionResult;

      const seriesVar = result.options.find((opt) => opt.label === '__series.name');
      expect(seriesVar?.apply).toBe(`\${${DataLinkBuiltInVars.seriesName}}`);
    });

    it('should apply includeVars without :queryparam suffix', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('test', 4, true);
      const result = autocompletion(context) as CompletionResult;

      const includeVars = result.options.find((opt) => opt.label === '__all_variables');
      expect(includeVars?.apply).toBe(`\${${DataLinkBuiltInVars.includeVars}}`);
    });
  });

  describe('trigger character matching', () => {
    it('should return null when no trigger character is present', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('https://grafana.com', 19);
      const result = autocompletion(context);

      expect(result).toBeNull();
    });

    it('should return null when text does not start with $ or =', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('test', 4);
      const result = autocompletion(context);

      expect(result).toBeNull();
    });
  });

  describe('$ trigger character', () => {
    it('should show completions when $ is typed', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('$', 1);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(4);
    });

    it('should show completions when ${ is typed', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${', 2);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(4);
    });

    it('should show completions when typing partial variable name', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${my', 4);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(4);
    });

    it('should show completions with dots in variable name', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${__series.name', 15);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(4);
    });

    it('should position completion from current position for single $', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('$', 1);
      const result = autocompletion(context) as CompletionResult;

      expect(result.from).toBe(1);
    });

    it('should position completion from $ for partial match', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${test', 6);
      const result = autocompletion(context) as CompletionResult;

      expect(result.from).toBe(0);
    });
  });

  describe('= trigger character', () => {
    it('should show completions when = is typed', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('=', 1);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(4);
    });

    it('should show completions after = in URL query parameter', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('https://example.com?param=', 26);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(4);
    });

    it('should position completion from current position for single =', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('=', 1);
      const result = autocompletion(context) as CompletionResult;

      expect(result.from).toBe(1);
    });
  });

  describe('variable application', () => {
    it('should use custom apply function for single character trigger', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('$', 1);
      const result = autocompletion(context) as CompletionResult;

      expect(typeof result.options[0].apply).toBe('function');
    });

    it('should use string apply for multi-character match', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${test', 6);
      const result = autocompletion(context) as CompletionResult;

      expect(typeof result.options[0].apply).toBe('string');
    });

    it('should apply correct variable syntax for Series origin', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${test', 6);
      const result = autocompletion(context) as CompletionResult;

      const seriesVar = result.options.find((opt) => opt.label === '__series.name');
      expect(seriesVar?.apply).toBe(`\${${DataLinkBuiltInVars.seriesName}}`);
    });

    it('should apply correct variable syntax for Field origin', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${test', 6);
      const result = autocompletion(context) as CompletionResult;

      const fieldVar = result.options.find((opt) => opt.label === '__field.name');
      expect(fieldVar?.apply).toBe(`\${${DataLinkBuiltInVars.fieldName}}`);
    });

    it('should apply correct variable syntax for Template origin', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${test', 6);
      const result = autocompletion(context) as CompletionResult;

      const templateVar = result.options.find((opt) => opt.label === 'myVar');
      expect(templateVar?.apply).toBe('${myVar:queryparam}');
    });

    it('should apply correct variable syntax for includeVars built-in', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${test', 6);
      const result = autocompletion(context) as CompletionResult;

      const includeVars = result.options.find((opt) => opt.label === '__all_variables');
      expect(includeVars?.apply).toBe(`\${${DataLinkBuiltInVars.includeVars}}`);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('', 0);
      const result = autocompletion(context);

      expect(result).toBeNull();
    });

    it('should handle $ at the end of longer text', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('https://grafana.com?var=$', 25);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(25);
    });

    it('should handle = at the end of longer text', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('https://grafana.com?var=', 24);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(24);
    });

    it('should handle mixed content with ${ in the middle', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('https://grafana.com?var=${', 26);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(4);
    });

    it('should handle single suggestion', () => {
      const singleSuggestion: VariableSuggestion[] = [
        {
          value: 'test',
          label: 'test',
          documentation: 'Test variable',
          origin: VariableOrigin.Template,
        },
      ];
      const autocompletion = dataLinkAutocompletion(singleSuggestion);
      const context = createMockContext('$', 1);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.options).toHaveLength(1);
      expect(result.options[0].label).toBe('test');
    });

    it('should include all metadata fields in completion options', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('$', 1);
      const result = autocompletion(context) as CompletionResult;

      result.options.forEach((option) => {
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('detail');
        expect(option).toHaveProperty('info');
        expect(option).toHaveProperty('apply');
        expect(option).toHaveProperty('type');
        expect(option.type).toBe('variable');
      });
    });
  });

  describe('completion context states', () => {
    it('should handle explicit completion in middle of text', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('https://example.com', 10, true);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(10);
      expect(result.options).toHaveLength(4);
    });

    it('should handle explicit completion at start of document', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('test', 0, true);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(0);
      expect(result.options).toHaveLength(4);
    });

    it('should not show completions for text without trigger when not explicit', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('test', 4);
      const result = autocompletion(context);

      expect(result).toBeNull();
    });
  });

  describe('multiple variables in text', () => {
    it('should handle completion after existing variable', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${myVar}$', 9);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(9);
    });

    it('should handle completion between variables', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('${var1}$${var2}', 8);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(8);
    });

    it('should handle completion in URL with multiple query params', () => {
      const autocompletion = dataLinkAutocompletion(mockSuggestions);
      const context = createMockContext('?a=${var1}&b=$', 14);
      const result = autocompletion(context) as CompletionResult;

      expect(result).not.toBeNull();
      expect(result.from).toBe(14);
    });
  });
});
