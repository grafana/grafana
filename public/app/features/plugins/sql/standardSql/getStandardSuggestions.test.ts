import { Registry } from '@grafana/data';
import { monacoTypes } from '@grafana/ui';

import { getMonacoMock } from '../mocks/Monaco';
import { TextModel } from '../mocks/TextModel';
import { singleLineFullQuery } from '../mocks/testData';
import { OperatorType, SuggestionKind, CustomSuggestion, PositionContext, MacroType } from '../types';
import { linkedTokenBuilder } from '../utils/linkedTokenBuilder';

import { getStandardSuggestions } from './getStandardSuggestions';
import { initStandardSuggestions } from './standardSuggestionsRegistry';
import { FunctionsRegistryItem, MacrosRegistryItem, OperatorsRegistryItem, SuggestionsRegistryItem } from './types';

describe('getStandardSuggestions', () => {
  const mockQueries = new Map<string, Array<Array<Pick<monacoTypes.Token, 'language' | 'offset' | 'type'>>>>();
  const cases = [{ query: singleLineFullQuery, position: { line: 1, column: 0 } }];
  cases.forEach((c) => mockQueries.set(c.query.query, c.query.tokens));
  const MonacoMock = getMonacoMock(mockQueries);
  const token = linkedTokenBuilder(MonacoMock, TextModel(singleLineFullQuery.query) as monacoTypes.editor.ITextModel, {
    lineNumber: 1,
    column: 0,
  });
  const posContextMock = {};

  it('calls the resolvers', async () => {
    const suggestionMock: CustomSuggestion = { label: 'customSuggest' };
    const resolveFunctionSpy = jest.fn().mockReturnValue([suggestionMock]);
    const kind = 'customSuggestionItemKind' as SuggestionKind;
    const suggestionsRegistry = new Registry<SuggestionsRegistryItem>(() => {
      return [
        {
          id: kind,
          name: 'customSuggestionItemKind',
          suggestions: resolveFunctionSpy,
        },
      ];
    });
    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [kind],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(resolveFunctionSpy).toBeCalledTimes(1);
    expect(resolveFunctionSpy).toBeCalledWith({ range: token!.range }, MonacoMock);

    expect(result).toHaveLength(1);
    expect(result[0].label).toEqual(suggestionMock.label);
  });

  it('suggests custom functions with arguments from the registry', async () => {
    const customFunction = {
      name: 'customFunction',
      id: 'customFunction',
    };

    const suggestionsRegistry = new Registry(
      initStandardSuggestions(
        new Registry<FunctionsRegistryItem>(() => [customFunction]),
        new Registry<OperatorsRegistryItem>(() => []),
        new Registry<MacrosRegistryItem>(() => [])
      )
    );

    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [SuggestionKind.FunctionsWithArguments],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(result).toHaveLength(1);
    expect(result[0].label).toEqual(customFunction.name);
  });

  it('suggests custom functions without arguments from the registry', async () => {
    const customFunction = {
      name: 'customFunction',
      id: 'customFunction',
    };

    const suggestionsRegistry = new Registry(
      initStandardSuggestions(
        new Registry<FunctionsRegistryItem>(() => [customFunction]),
        new Registry<OperatorsRegistryItem>(() => []),
        new Registry<MacrosRegistryItem>(() => [])
      )
    );

    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [SuggestionKind.FunctionsWithoutArguments],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(result).toHaveLength(1);
    expect(result[0].label).toEqual(customFunction.name);
  });

  it('suggests custom logical operators from the registry', async () => {
    const customLogicalOperator = {
      type: OperatorType.Logical,
      name: 'customOperator',
      id: 'customOperator',
      operator: '½',
    };

    const suggestionsRegistry = new Registry(
      initStandardSuggestions(
        new Registry<FunctionsRegistryItem>(() => []),
        new Registry<OperatorsRegistryItem>(() => [customLogicalOperator]),
        new Registry<MacrosRegistryItem>(() => [])
      )
    );

    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [SuggestionKind.LogicalOperators],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(result).toHaveLength(1);
    expect(result[0].label).toEqual(customLogicalOperator.operator);
  });

  it('suggests custom comparison operators from the registry', async () => {
    const customComparisonOperator = {
      type: OperatorType.Comparison,
      name: 'customOperator',
      id: 'customOperator',
      operator: '§',
    };

    const suggestionsRegistry = new Registry(
      initStandardSuggestions(
        new Registry<FunctionsRegistryItem>(() => []),
        new Registry<OperatorsRegistryItem>(() => [customComparisonOperator]),
        new Registry<MacrosRegistryItem>(() => [])
      )
    );

    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [SuggestionKind.ComparisonOperators],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(result).toHaveLength(5);
    expect(result[0].label).toEqual(customComparisonOperator.operator);
  });

  it('does not suggest logical operators when asked for comparison operators', async () => {
    const customLogicalOperator = {
      type: OperatorType.Logical,
      name: 'customOperator',
      id: 'customOperator',
      operator: '§',
    };

    const suggestionsRegistry = new Registry(
      initStandardSuggestions(
        new Registry<FunctionsRegistryItem>(() => []),
        new Registry<OperatorsRegistryItem>(() => [customLogicalOperator]),
        new Registry<MacrosRegistryItem>(() => [])
      )
    );

    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [SuggestionKind.ComparisonOperators],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(result).toHaveLength(4);
  });

  it('suggests $__time(dateColumn) macro when in column position', async () => {
    const customMacro: MacrosRegistryItem = {
      name: '$__time',
      id: '$__time',
      text: '$__time',
      type: MacroType.Value,
    };

    const suggestionsRegistry = new Registry(
      initStandardSuggestions(
        new Registry<FunctionsRegistryItem>(() => []),
        new Registry<OperatorsRegistryItem>(() => []),
        new Registry<MacrosRegistryItem>(() => [customMacro])
      )
    );

    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [SuggestionKind.SelectMacro],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(result).toHaveLength(1);
    expect(result[0].label).toEqual('$__time');
  });

  it('suggests SELECT and SELECT FROM from the standard registry', async () => {
    const suggestionsRegistry = new Registry(
      initStandardSuggestions(
        new Registry<FunctionsRegistryItem>(() => []),
        new Registry<OperatorsRegistryItem>(() => []),
        new Registry<MacrosRegistryItem>(() => [])
      )
    );

    const result = await getStandardSuggestions(
      MonacoMock,
      token,
      [SuggestionKind.SelectKeyword],
      posContextMock as PositionContext,
      suggestionsRegistry
    );

    expect(result).toHaveLength(2);
    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "command": Object {
            "id": "editor.action.triggerSuggest",
            "title": "",
          },
          "insertText": "SELECT $0",
          "insertTextRules": 4,
          "kind": 27,
          "label": "SELECT <column>",
          "range": Object {
            "endColumn": 7,
            "endLineNumber": 1,
            "startColumn": 0,
            "startLineNumber": 1,
          },
          "sortText": "g",
        },
        Object {
          "command": Object {
            "id": "editor.action.triggerSuggest",
            "title": "",
          },
          "insertText": "SELECT $2 FROM $1",
          "insertTextRules": 4,
          "kind": 27,
          "label": "SELECT <column> FROM <table>",
          "range": Object {
            "endColumn": 7,
            "endLineNumber": 1,
            "startColumn": 0,
            "startLineNumber": 1,
          },
          "sortText": "g",
        },
      ]
    `);
  });
});
