import { IMarkdownString } from 'monaco-editor';

import { SelectableValue } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import type { Monaco, monacoTypes } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import TempoLanguageProvider from '../language_provider';

import { getSituation, Situation } from './situation';
import { intrinsics, scopes } from './traceql';

interface Props {
  languageProvider: TempoLanguageProvider;
}

type MinimalCompletionItem = {
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string | IMarkdownString;
};

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

  constructor(props: Props) {
    this.languageProvider = props.languageProvider;
    this.registerInteractionCommandId = null;
  }

  triggerCharacters = ['{', '.', '[', '(', '=', '~', ' ', '"'];

  // Operators
  static readonly operators: MinimalCompletionItem[] = [
    {
      label: '=',
      insertText: '=',
      detail: 'Equal',
    },
    {
      label: '-',
      insertText: '-',
      detail: 'Minus',
    },
    {
      label: '+',
      insertText: '+',
      detail: 'Plus',
    },
    {
      label: '<',
      insertText: '<',
      detail: 'Less than',
    },
    {
      label: '>',
      insertText: '>',
      detail: 'Greater than',
    },
    {
      label: '<=',
      insertText: '<=',
      detail: 'Less than or equal to',
    },
    {
      label: '>=',
      insertText: '>=',
      detail: 'Greater than or equal to',
    },
    {
      label: '=~',
      insertText: '=~',
      detail: 'Regular expression',
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
      detail: 'Regular expression)',
    },
    {
      label: '!~',
      insertText: '!~',
      detail: 'Negated regular expression)',
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
  static readonly spansetAggregatorOps: MinimalCompletionItem[] = [
    {
      label: 'count',
      insertText: 'count()$0',
      detail: 'Number of spans',
      documentation: 'Counts the number of spans in a spanset',
    },
    {
      label: 'avg',
      insertText: 'avg($0)',
      detail: 'Average of attribute',
      documentation: 'Computes the average of a given numeric attribute or intrinsic for a spanset.',
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
    ...this.spansetAggregatorOps,
    {
      label: 'by',
      insertText: 'by($0)',
      detail: 'Grouping of attributes',
      documentation: 'Groups by arbitrary attributes.',
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
    const completionItems = situation != null ? this.getCompletions(situation) : Promise.resolve([]);

    return completionItems.then((items) => {
      // monaco by-default alphabetically orders the items.
      // to stop it, we use a number-as-string sortkey,
      // so that monaco keeps the order we use
      const maxIndexDigits = items.length.toString().length;
      const suggestions: monacoTypes.languages.CompletionItem[] = items.map((item, index) => {
        const suggestion: monacoTypes.languages.CompletionItem = {
          kind: getMonacoCompletionItemKind(item.type, this.monaco!),
          label: item.label,
          insertText: item.insertText,
          insertTextRules: item.insertTextRules,
          detail: item.detail,
          documentation: item.documentation,
          sortText: index.toString().padStart(maxIndexDigits, '0'), // to force the order we have
          range,
          command: {
            id: this.registerInteractionCommandId || 'noOp',
            title: 'Report Interaction',
            arguments: [item.label, item.type],
          },
        };
        fixSuggestion(suggestion, item.type, model, offset);
        return suggestion;
      });
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

    if (this.cachedValues.hasOwnProperty(tagName)) {
      tagValues = this.cachedValues[tagName];
    } else {
      tagValues = await this.languageProvider.getOptionsV2(tagName, query);
      this.cachedValues[tagName] = tagValues;
    }
    return tagValues;
  }

  /**
   * Get suggestion based on the situation we are in like whether we should suggest tag names or values.
   * @param situation
   * @private
   */
  private async getCompletions(situation: Situation): Promise<Completion[]> {
    switch (situation.type) {
      // Not really sure what would make sense to suggest in this case so just leave it
      case 'UNKNOWN': {
        return [];
      }
      case 'EMPTY': {
        return this.getScopesCompletions('{ ')
          .concat(this.getIntrinsicsCompletions('{ '))
          .concat(this.getTagsCompletions('{ .'));
      }
      case 'SPANSET_EMPTY':
        return this.getScopesCompletions().concat(this.getIntrinsicsCompletions()).concat(this.getTagsCompletions('.'));
      case 'SPANSET_ONLY_DOT': {
        return this.getTagsCompletions();
      }
      case 'SPANSET_IN_NAME':
        return this.getScopesCompletions().concat(this.getIntrinsicsCompletions()).concat(this.getTagsCompletions());
      case 'SPANSET_IN_NAME_SCOPE':
        return this.getTagsCompletions(undefined, situation.scope);
      case 'SPANSET_EXPRESSION_OPERATORS':
        return [...CompletionProvider.logicalOps, ...CompletionProvider.operators].map((key) => ({
          label: key.label,
          insertText: key.insertText,
          detail: key.detail,
          documentation: key.documentation,
          type: 'OPERATOR',
        }));
      case 'SPANSET_COMBINING_OPERATORS':
        return CompletionProvider.spansetOps.map((key) => ({
          label: key.label,
          insertText: key.insertText,
          detail: key.detail,
          documentation: key.documentation,
          type: 'OPERATOR',
        }));
      case 'SPANSET_PIPELINE_AFTER_OPERATOR':
        return CompletionProvider.functions.map((key) => ({
          label: key.label,
          insertText: key.insertText,
          detail: key.detail,
          documentation: key.documentation,
          insertTextRules: this.monaco?.languages.CompletionItemInsertTextRule?.InsertAsSnippet,
          type: 'FUNCTION',
        }));
      case 'SPANSET_COMPARISON_OPERATORS':
        return CompletionProvider.comparisonOps.map((key) => ({
          label: key.label,
          insertText: key.insertText,
          detail: key.detail,
          documentation: key.documentation,
          type: 'OPERATOR',
        }));
      case 'SPANSET_IN_VALUE':
        let tagValues;
        try {
          tagValues = await this.getTagValues(situation.tagName, situation.query);
        } catch (error) {
          if (isFetchError(error)) {
            dispatch(notifyApp(createErrorNotification(error.data.error, new Error(error.data.message))));
          } else if (error instanceof Error) {
            dispatch(notifyApp(createErrorNotification('Error', error)));
          }
        }

        const items: Completion[] = [];

        const getInsertionText = (val: SelectableValue<string>): string => {
          if (situation.betweenQuotes) {
            return val.label!;
          }
          return val.type === 'string' ? `"${val.label}"` : val.label!;
        };

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
        return CompletionProvider.logicalOps
          .map((l) => l.insertText)
          .concat('}')
          .map((key) => ({
            label: key,
            insertText: key,
            type: 'OPERATOR',
          }));
      default:
        throw new Error(`Unexpected situation ${situation}`);
    }
  }

  private getTagsCompletions(prepend?: string, scope?: string): Completion[] {
    const tags = this.languageProvider.getTraceqlAutocompleteTags(scope);
    return tags
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'accent' }))
      .map((key) => ({
        label: key,
        insertText: (prepend || '') + key,
        type: 'TAG_NAME',
      }));
  }

  private getIntrinsicsCompletions(prepend?: string): Completion[] {
    return intrinsics.map((key) => ({
      label: key,
      insertText: (prepend || '') + key,
      type: 'KEYWORD',
    }));
  }

  private getScopesCompletions(prepend?: string): Completion[] {
    return scopes.map((key) => ({
      label: key,
      insertText: (prepend || '') + key,
      type: 'SCOPE',
    }));
  }
}

/**
 * Get item kind which is used for icon next to the suggestion.
 * @param type
 * @param monaco
 */
function getMonacoCompletionItemKind(type: CompletionType, monaco: Monaco): monacoTypes.languages.CompletionItemKind {
  switch (type) {
    case 'TAG_NAME':
      return monaco.languages.CompletionItemKind.Enum;
    case 'KEYWORD':
      return monaco.languages.CompletionItemKind.Keyword;
    case 'OPERATOR':
      return monaco.languages.CompletionItemKind.Operator;
    case 'TAG_VALUE':
      return monaco.languages.CompletionItemKind.EnumMember;
    case 'SCOPE':
      return monaco.languages.CompletionItemKind.Class;
    case 'FUNCTION':
      return monaco.languages.CompletionItemKind.Function;
    default:
      throw new Error(`Unexpected CompletionType: ${type}`);
  }
}

export type CompletionType = 'TAG_NAME' | 'TAG_VALUE' | 'KEYWORD' | 'OPERATOR' | 'SCOPE' | 'FUNCTION';
type Completion = {
  type: CompletionType;
  label: string;
  insertText: string;
  insertTextRules?: monacoTypes.languages.CompletionItemInsertTextRule; // we used it to position the cursor
  documentation?: string | IMarkdownString;
  detail?: string;
};

export type Tag = {
  name: string;
  value: string;
};

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

/**
 * Fix the suggestions range and insert text. For the range we have to adjust because monaco by default replaces just
 * the last word which stops at dot while traceQL tags contain dots themselves and we want to replace the whole tag
 * name when suggesting. The insert text needs to be adjusted for scope (leading dot) if scope is currently missing.
 * This may be doable also when creating the suggestions but for a particular situation this seems to be easier to do
 * here.
 */
function fixSuggestion(
  suggestion: monacoTypes.languages.CompletionItem,
  itemType: CompletionType,
  model: monacoTypes.editor.ITextModel,
  offset: number
) {
  if (itemType === 'TAG_NAME') {
    const match = model
      .getValue()
      .substring(0, offset)
      .match(/(span\.|resource\.|\.)?([\w./-]*)$/);

    if (match) {
      const scope = match[1];
      const tag = match[2];

      if (tag) {
        // Add the default scope if needed.
        if (!scope && suggestion.insertText[0] !== '.') {
          suggestion.insertText = '.' + suggestion.insertText;
        }

        // Adjust the range, so that we will replace the whole tag.
        suggestion.range = {
          ...suggestion.range,
          startColumn: offset - tag.length + 1,
        };
      }
    }
  }
}
