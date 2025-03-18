import { IMarkdownString, languages } from 'monaco-editor';

import { SelectableValue } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import type { Monaco, monacoTypes } from '@grafana/ui';

import TempoLanguageProvider from '../language_provider';

import { getSituation, Situation } from './situation';
import { scopes } from './traceql';

type MinimalCompletionItem = {
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string | IMarkdownString;
};

export type CompletionItemType = 'TAG_NAME' | 'TAG_VALUE' | 'KEYWORD' | 'OPERATOR' | 'SCOPE' | 'FUNCTION';
type CompletionItem = MinimalCompletionItem & {
  type: CompletionItemType;
  insertTextRules?: monacoTypes.languages.CompletionItemInsertTextRule; // we used it to position the cursor
};

interface Props {
  languageProvider: TempoLanguageProvider;
  setAlertText: (text?: string) => void;
}

/**
 * Class that implements CompletionItemProvider interface and allows us to provide suggestion for the Monaco
 * autocomplete system.
 *
 * Here we want to provide suggestions for TraceQL. Please refer to
 * https://grafana.com/docs/tempo/latest/traceql for the syntax of the language.
 */
export class CompletionProvider implements monacoTypes.languages.CompletionItemProvider {
  languageProvider: TempoLanguageProvider;
  registerInteractionCommandId: string | null;
  setAlertText: (text?: string) => void;

  constructor(props: Props) {
    this.languageProvider = props.languageProvider;
    this.setAlertText = props.setAlertText;
    this.registerInteractionCommandId = null;
  }

  triggerCharacters = ['{', '.', '[', '(', '=', '~', ' ', '"'];

  // Operators
  static readonly arithmeticOps: MinimalCompletionItem[] = [
    {
      label: '+',
      insertText: '+',
      detail: 'Plus',
    },
    {
      label: '-',
      insertText: '-',
      detail: 'Minus',
    },
    {
      label: '*',
      insertText: '*',
      detail: 'Times',
    },
    {
      label: '/',
      insertText: '/',
      detail: 'Over',
    },
  ];

  static readonly logicalOps: MinimalCompletionItem[] = [
    {
      label: '&&',
      insertText: '&&',
      detail: 'And',
      documentation: 'And (intersection) operator. Checks that both conditions found matches.',
    },
    {
      label: '||',
      insertText: '||',
      detail: 'Or',
      documentation: 'Or (union) operator. Checks that either condition found matches.',
    },
  ];

  static readonly comparisonOps: MinimalCompletionItem[] = [
    {
      label: '=',
      insertText: '=',
      detail: 'Equality',
    },
    {
      label: '!=',
      insertText: '!=',
      detail: 'Inequality',
    },
    {
      label: '>',
      insertText: '>',
      detail: 'Greater than',
    },
    {
      label: '>=',
      insertText: '>=',
      detail: 'Greater than or equal to',
    },
    {
      label: '<',
      insertText: '<',
      detail: 'Less than',
    },
    {
      label: '<=',
      insertText: '<=',
      detail: 'Less than or equal to',
    },
    {
      label: '=~',
      insertText: '=~',
      detail: 'Regular expression',
    },
    {
      label: '!~',
      insertText: '!~',
      detail: 'Negated regular expression',
    },
  ];
  static readonly structuralOps: MinimalCompletionItem[] = [
    {
      label: '>>',
      insertText: '>>',
      detail: 'Descendant',
      documentation:
        'Descendant operator. Looks for spans matching {condB} that are descendants of a span matching {condA}',
    },
    {
      label: '>',
      insertText: '>',
      detail: 'Child',
      documentation:
        'Child operator. Looks for spans matching {condB} that are direct child spans of a parent matching {condA}',
    },
    {
      label: '<<',
      insertText: '<<',
      detail: 'Ancestor',
      documentation:
        'Ancestor operator. Looks for spans matching {condB} that are ancestors of a span matching {condA}',
    },
    {
      label: '<',
      insertText: '<',
      detail: 'Parent',
      documentation:
        'Parent operator. Looks for spans matching {condB} that are direct parent spans of a child matching {condA}',
    },
    {
      label: '~',
      insertText: '~',
      detail: 'Sibling',
      documentation:
        'Sibling operator. Checks that spans matching {condA} and {condB} are siblings of the same parent span.',
    },
  ];

  static readonly spansetOps: MinimalCompletionItem[] = [
    {
      label: '|',
      insertText: '|',
      detail: 'Pipe',
    },
    ...CompletionProvider.logicalOps,
    ...CompletionProvider.structuralOps,
  ];

  // Functions (aggregator, selector, and combining operators)
  static readonly aggregatorFunctions: MinimalCompletionItem[] = [
    {
      label: 'avg',
      insertText: 'avg($0)',
      detail: 'Average of attribute',
      documentation: 'Computes the average of a given numeric attribute or intrinsic for a spanset.',
    },
    {
      label: 'count',
      insertText: 'count()$0',
      detail: 'Number of spans',
      documentation: 'Counts the number of spans in a spanset.',
    },
    {
      label: 'max',
      insertText: 'max($0)',
      detail: 'Max value of attribute',
      documentation: 'Computes the maximum value of a given numeric attribute or intrinsic for a spanset.',
    },
    {
      label: 'min',
      insertText: 'min($0)',
      detail: 'Min value of attribute',
      documentation: 'Computes the minimum value of a given numeric attribute or intrinsic for a spanset.',
    },
    {
      label: 'sum',
      insertText: 'sum($0)',
      detail: 'Sum value of attribute',
      documentation: 'Computes the sum value of a given numeric attribute or intrinsic for a spanset.',
    },
  ];

  static readonly functions: MinimalCompletionItem[] = [
    ...this.aggregatorFunctions,
    {
      label: 'by',
      insertText: 'by($0)',
      detail: 'Grouping of attributes',
      documentation: 'Groups by arbitrary attributes.',
    },
    {
      label: 'count_over_time',
      insertText: 'count_over_time()$0',
      detail: 'Number of spans over time',
      documentation: 'Counts the number of spans over time.',
    },
    {
      label: 'histogram_over_time',
      insertText: 'histogram_over_time($0)',
      detail: 'Histogram of attribute over time',
      documentation: 'Retrieves a histogram of an attributes values over time which are sorted into buckets.',
    },
    {
      label: 'quantile_over_time',
      insertText: 'quantile_over_time($0)',
      detail: 'Quantile of attribute over time',
      documentation: 'Retrieves one or more quantiles of an attributes numeric values over time.',
    },
    {
      label: 'rate',
      insertText: 'rate()$0',
      detail: 'Rate of spans',
      documentation: 'Counts the rate of spans per second.',
    },
    {
      label: 'select',
      insertText: 'select($0)',
      detail: 'Selection of fields',
      documentation: 'Selects arbitrary fields from spans.',
    },
  ];

  // We set these directly and ae required for the provider to function.
  monaco: Monaco | undefined;
  editor: monacoTypes.editor.IStandaloneCodeEditor | undefined;

  private cachedValues: { [key: string]: Array<SelectableValue<string>> } = {};

  provideCompletionItems(
    model: monacoTypes.editor.ITextModel,
    position: monacoTypes.Position
  ): monacoTypes.languages.ProviderResult<monacoTypes.languages.CompletionList> {
    // Should not happen, this should not be called before it is initialized
    if (!(this.monaco && this.editor)) {
      throw new Error('provideCompletionItems called before CompletionProvider was initialized');
    }

    // if the model-id does not match, then this call is from a different editor-instance,
    // not "our instance", so return nothing
    if (this.editor.getModel()?.id !== model.id) {
      return { suggestions: [] };
    }

    const { range, offset } = getRangeAndOffset(this.monaco, model, position);
    const situation = getSituation(model.getValue(), offset);
    const completionItems = situation != null ? this.getCompletions(situation, this.setAlertText) : Promise.resolve([]);

    return completionItems.then((items) => {
      const suggestions = completionItemsToSuggestions(
        items,
        range,
        this.registerInteractionCommandId ?? undefined,
        model.getValue(),
        offset
      );
      return { suggestions };
    });
  }

  /**
   * Set the ID for the registerInteraction command, to be used to keep track of how many completions are used by the users
   */
  setRegisterInteractionCommandId(id: string | null) {
    this.registerInteractionCommandId = id;
  }

  private async getTagValues(tagName: string, query: string): Promise<Array<SelectableValue<string>>> {
    let tagValues: Array<SelectableValue<string>>;
    const cacheKey = `${tagName}:${query}`;

    if (this.cachedValues.hasOwnProperty(cacheKey)) {
      tagValues = this.cachedValues[cacheKey];
    } else {
      tagValues = await this.languageProvider.getOptionsV2(tagName, query);
      this.cachedValues[cacheKey] = tagValues;
    }
    return tagValues;
  }

  /**
   * Get suggestion based on the situation we are in like whether we should suggest tag names or values.
   * @param situation
   * @private
   */
  private async getCompletions(situation: Situation, setAlertText: (text?: string) => void): Promise<CompletionItem[]> {
    switch (situation.type) {
      // This should only happen for cases that we do not support yet
      case 'UNKNOWN': {
        return [];
      }
      case 'EMPTY': {
        return this.getScopesCompletions('{ ', '$0 }')
          .concat(this.getIntrinsicsCompletions('{ ', '$0 }'))
          .concat(this.getTagsCompletions('{ .'));
      }
      case 'SPANSET_EMPTY':
        return this.getScopesCompletions().concat(this.getIntrinsicsCompletions()).concat(this.getTagsCompletions('.'));
      case 'SPANSET_ONLY_DOT': {
        return this.getTagsCompletions();
      }
      case 'SPANSET_IN_THE_MIDDLE':
      case 'SPANSET_EXPRESSION_OPERATORS_WITH_MISSING_CLOSED_BRACE':
        return this.getOperatorsCompletions([...CompletionProvider.comparisonOps, ...CompletionProvider.logicalOps]);
      case 'SPANSET_IN_NAME':
        return this.getScopesCompletions().concat(this.getIntrinsicsCompletions()).concat(this.getTagsCompletions());
      case 'SPANSET_IN_NAME_SCOPE':
        return this.getTagsCompletions(undefined, situation.scope);
      case 'SPANSET_EXPRESSION_OPERATORS':
        return this.getOperatorsCompletions([
          ...CompletionProvider.comparisonOps,
          ...CompletionProvider.logicalOps,
          ...CompletionProvider.arithmeticOps,
        ]);
      case 'SPANFIELD_COMBINING_OPERATORS':
        return this.getOperatorsCompletions([
          ...CompletionProvider.logicalOps,
          ...CompletionProvider.arithmeticOps,
          ...CompletionProvider.comparisonOps,
        ]);
      case 'SPANSET_COMBINING_OPERATORS':
        return this.getOperatorsCompletions(CompletionProvider.spansetOps);
      case 'SPANSET_PIPELINE_AFTER_OPERATOR':
        const functions = CompletionProvider.functions.map((key) => ({
          ...key,
          insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
          type: 'FUNCTION' as const,
        }));
        const tags = this.getScopesCompletions()
          .concat(this.getIntrinsicsCompletions())
          .concat(this.getTagsCompletions('.'));
        return [...functions, ...tags];
      case 'SPANSET_COMPARISON_OPERATORS':
        return this.getOperatorsCompletions(CompletionProvider.comparisonOps);
      case 'SPANSET_IN_VALUE':
        let tagValues;
        try {
          tagValues = await this.getTagValues(situation.tagName, situation.query);
          setAlertText(undefined);
        } catch (error) {
          if (isFetchError(error)) {
            setAlertText(error.data.error);
          } else if (error instanceof Error) {
            setAlertText(`Error: ${error.message}`);
          }
        }

        const getInsertionText = (val: SelectableValue<string>): string => {
          if (situation.betweenQuotes) {
            return val.label!;
          }
          return val.type === 'string' ? `"${val.label}"` : val.label!;
        };

        const items: CompletionItem[] = [];
        tagValues?.forEach((val) => {
          if (val?.label) {
            items.push({
              label: val.label,
              insertText: getInsertionText(val),
              type: 'TAG_VALUE',
            });
          }
        });
        return items;
      case 'SPANSET_AFTER_VALUE':
        return CompletionProvider.logicalOps.map((key) => ({
          label: key.label,
          insertText: key.insertText + '}',
          type: 'OPERATOR',
        }));
      case 'NEW_SPANSET':
        return this.getScopesCompletions('{ ', '$0 }')
          .concat(this.getIntrinsicsCompletions('{ ', '$0 }'))
          .concat(this.getTagsCompletions('.'));
      case 'ATTRIBUTE_FOR_FUNCTION':
        return this.getScopesCompletions().concat(this.getIntrinsicsCompletions()).concat(this.getTagsCompletions('.'));
      default:
        throw new Error(`Unexpected situation ${situation}`);
    }
  }

  private getTagsCompletions(prepend?: string, scope?: string): CompletionItem[] {
    const tags = this.languageProvider.getTraceqlAutocompleteTags(scope);
    return tagsToCompletionItems(tags, prepend);
  }

  private getIntrinsicsCompletions(prepend?: string, append?: string): CompletionItem[] {
    return this.languageProvider.getIntrinsics().map((key) => ({
      label: key,
      insertText: (prepend || '') + key + (append || ''),
      type: 'KEYWORD',
      insertTextRules: languages.CompletionItemInsertTextRule?.InsertAsSnippet,
    }));
  }

  private getScopesCompletions(prepend?: string, append?: string): CompletionItem[] {
    return scopes.map((key) => ({
      label: key,
      insertText: (prepend || '') + key + (append || ''),
      type: 'SCOPE',
      insertTextRules: languages.CompletionItemInsertTextRule?.InsertAsSnippet,
    }));
  }

  private getOperatorsCompletions(ops: MinimalCompletionItem[]): CompletionItem[] {
    return ops.map((key) => ({
      ...key,
      type: 'OPERATOR',
    }));
  }
}

/**
 * Get item kind which is used for icon next to the suggestion.
 * @param type
 * @param monaco
 */
function getMonacoCompletionItemKind(type: CompletionItemType): languages.CompletionItemKind {
  switch (type) {
    case 'TAG_NAME':
      return languages.CompletionItemKind.Enum;
    case 'KEYWORD':
      return languages.CompletionItemKind.Keyword;
    case 'OPERATOR':
      return languages.CompletionItemKind.Operator;
    case 'TAG_VALUE':
      return languages.CompletionItemKind.EnumMember;
    case 'SCOPE':
      return languages.CompletionItemKind.Class;
    case 'FUNCTION':
      return languages.CompletionItemKind.Function;
    default:
      throw new Error(`Unexpected CompletionItemType: ${type}`);
  }
}

function getRangeAndOffset(monaco: Monaco, model: monacoTypes.editor.ITextModel, position: monacoTypes.Position) {
  const word = model.getWordAtPosition(position);
  const range =
    word != null
      ? monaco.Range.lift({
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        })
      : monaco.Range.fromPositions(position);

  // documentation says `position` will be "adjusted" in `getOffsetAt` so we clone it here just for sure.
  const positionClone = {
    column: position.column,
    lineNumber: position.lineNumber,
  };

  const offset = model.getOffsetAt(positionClone);
  return { offset, range };
}

const SUGGEST_REGEXP = /(event\.|instrumentation\.|link\.|resource\.|span\.|\.)?([\w./-]*)$/;

function completionItemsToSuggestions(
  items: CompletionItem[],
  range: monacoTypes.IRange | languages.CompletionItemRanges,
  registerInteractionCommandId = 'noOp',
  modelValue: string,
  offset: number
) {
  // monaco by-default alphabetically orders the items.
  // to stop it, we use a number-as-string sortkey,
  // so that monaco keeps the order we use
  const [_, scope, tag] = modelValue.substring(0, offset).match(SUGGEST_REGEXP) ?? [];
  const maxIndexDigits = items.length.toString().length;
  const suggestions: languages.CompletionItem[] = items.map((item, index) => {
    const suggestion: languages.CompletionItem = {
      kind: getMonacoCompletionItemKind(item.type),
      label: item.label,
      insertText: item.insertText,
      insertTextRules: item.insertTextRules,
      detail: item.detail,
      documentation: item.documentation,
      sortText: index.toString().padStart(maxIndexDigits, '0'), // to force the order we have
      range,
      command: {
        id: registerInteractionCommandId,
        title: 'Report Interaction',
        arguments: [item.label, item.type],
      },
    };

    if (tag && item.type === 'TAG_NAME') {
      fixSuggestion(suggestion, offset, tag, scope);
    }

    return suggestion;
  });

  return suggestions;
}

/**
 * Fix the suggestions range and insert text. For the range we have to adjust because monaco by default replaces just
 * the last word which stops at dot while traceQL tags contain dots themselves and we want to replace the whole tag
 * name when suggesting. The insert text needs to be adjusted for scope (leading dot) if scope is currently missing.
 * This may be doable also when creating the suggestions but for a particular situation this seems to be easier to do
 * here.
 */
function fixSuggestion(suggestion: monacoTypes.languages.CompletionItem, offset: number, tag: string, scope?: string) {
  // Add the default scope if needed.
  if (scope == null && suggestion.insertText[0] !== '.') {
    suggestion.insertText = '.' + suggestion.insertText;
  }

  // Adjust the range, so that we will replace the whole tag.
  suggestion.range = {
    ...suggestion.range,
    startColumn: offset - tag.length + 1,
  };
}

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

function tagsToCompletionItems(tags: string[], prepend = ''): CompletionItem[] {
  return tags.sort(collator.compare).map((key) => ({
    label: key,
    insertText: `${prepend}${key}`,
    type: 'TAG_NAME',
  }));
}
