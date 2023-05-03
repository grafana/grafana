import { SelectableValue } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import type { Monaco, monacoTypes } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import TempoLanguageProvider from '../language_provider';

import { intrinsics, scopes } from './traceql';

interface Props {
  languageProvider: TempoLanguageProvider;
}

/**
 * Class that implements CompletionItemProvider interface and allows us to provide suggestion for the Monaco
 * autocomplete system.
 */
export class CompletionProvider implements monacoTypes.languages.CompletionItemProvider {
  languageProvider: TempoLanguageProvider;
  registerInteractionCommandId: string | null;

  constructor(props: Props) {
    this.languageProvider = props.languageProvider;
    this.registerInteractionCommandId = null;
  }

  triggerCharacters = ['{', '.', '[', '(', '=', '~', ' ', '"'];
  static readonly operators: string[] = ['=', '-', '+', '<', '>', '>=', '<=', '=~'];
  static readonly logicalOps: string[] = ['&&', '||'];

  // We set these directly and ae required for the provider to function.
  monaco: Monaco | undefined;
  editor: monacoTypes.editor.IStandaloneCodeEditor | undefined;

  private tags: { [tag: string]: Set<string> } = {};
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
    const situation = this.getSituation(model.getValue(), offset);
    const completionItems = this.getCompletions(situation);

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
   * We expect the tags list data directly from the request and assign it an empty set here.
   */
  setTags(tags: string[]) {
    tags.forEach((t) => (this.tags[t] = new Set<string>()));
  }

  /**
   * Set the ID for the registerInteraction command, to be used to keep track of how many completions are used by the users
   */
  setRegisterInteractionCommandId(id: string | null) {
    this.registerInteractionCommandId = id;
  }

  private async getTagValues(tagName: string): Promise<Array<SelectableValue<string>>> {
    let tagValues: Array<SelectableValue<string>>;

    if (this.cachedValues.hasOwnProperty(tagName)) {
      tagValues = this.cachedValues[tagName];
    } else {
      tagValues = await this.languageProvider.getOptionsV2(tagName);
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
    if (!Object.keys(this.tags).length) {
      return [];
    }
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
        return this.getTagsCompletions();
      case 'SPANSET_AFTER_NAME':
        return CompletionProvider.operators.map((key) => ({
          label: key,
          insertText: key,
          type: 'OPERATOR',
        }));
      case 'SPANSET_IN_VALUE':
        let tagValues;
        try {
          tagValues = await this.getTagValues(situation.tagName);
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
        return CompletionProvider.logicalOps.concat('}').map((key) => ({
          label: key,
          insertText: key,
          type: 'OPERATOR',
        }));
      default:
        throw new Error(`Unexpected situation ${situation}`);
    }
  }

  private getTagsCompletions(prepend?: string): Completion[] {
    return Object.keys(this.tags)
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

  private getSituationInSpanSet(textUntilCaret: string): Situation {
    const nameRegex = /(?<name>[\w./-]+)?/;
    const opRegex = /(?<op>[!=+\-<>]+)/;
    // only allow spaces in the value if it's enclosed by quotes
    const valueRegex = /(?<value>(?<open_quote>")([^"\n&|]+)?(?<close_quote>")?|([^"\n\s&|]+))?/;

    // prettier-ignore
    const fullRegex = new RegExp(
      '([\\s{])' +      // Space(s) or initial opening bracket {
      '(' +                   // Open full set group
      nameRegex.source +
      '(?<space1>\\s*)' +     // Optional space(s) between name and operator
      '(' +                   // Open operator + value group
      opRegex.source +
      '(?<space2>\\s*)' +     // Optional space(s) between operator and value
      valueRegex.source +
      ')?' +                  // Close operator + value group
      ')' +                   // Close full set group
      '(?<space3>\\s*)$'      // Optional space(s) at the end of the set
    );

    const matched = textUntilCaret.match(fullRegex);

    if (matched) {
      const nameFull = matched.groups?.name;
      const op = matched.groups?.op;

      if (!nameFull) {
        return {
          type: 'SPANSET_EMPTY',
        };
      }

      if (nameFull === '.') {
        return {
          type: 'SPANSET_ONLY_DOT',
        };
      }

      const nameMatched = nameFull.match(/^(?<pre_dot>\.)?(?<word>\w[\w./-]*\w)(?<post_dot>\.)?$/);

      // We already have a (potentially partial) tag name so let's check if there's an operator declared
      // { .tag_name|
      if (!op) {
        // There's no operator so we check if the name is one of the known scopes
        // { resource.|
        if (scopes.filter((w) => w === nameMatched?.groups?.word) && nameMatched?.groups?.post_dot) {
          return {
            type: 'SPANSET_IN_NAME_SCOPE',
          };
        }
        // It's not one of the scopes, so we now check if we're after the name (there's a space after the word) or if we still have to autocomplete the rest of the name
        // In case there's a space we start autocompleting the operators { .http.method |
        // Otherwise we keep showing the tags/intrinsics/scopes list { .http.met|
        return {
          type: matched.groups?.space1 ? 'SPANSET_AFTER_NAME' : 'SPANSET_IN_NAME',
        };
      }

      // In case there's a space after the full [name + operator + value] group we can start autocompleting logical operators or close the spanset
      // To avoid triggering this situation when we are writing a space inside a string we check the state of the open and close quotes
      // { .http.method = "GET" |
      if (matched.groups?.space3 && matched.groups.open_quote === matched.groups.close_quote) {
        return {
          type: 'SPANSET_AFTER_VALUE',
        };
      }

      // We already have an operator and know that the set isn't complete so let's autocomplete the possible values for the tag name
      // { .http.method = |
      return {
        type: 'SPANSET_IN_VALUE',
        tagName: nameFull,
        betweenQuotes: !!matched.groups?.open_quote,
      };
    }

    return {
      type: 'EMPTY',
    };
  }

  /**
   * Figure out where is the cursor and what kind of suggestions are appropriate.
   * @param text
   * @param offset
   */
  private getSituation(text: string, offset: number): Situation {
    if (text === '' || offset === 0) {
      return {
        type: 'EMPTY',
      };
    }

    const textUntilCaret = text.substring(0, offset);

    // Check if we're inside a span set
    let isInSpanSet = textUntilCaret.lastIndexOf('{') > textUntilCaret.lastIndexOf('}');
    if (isInSpanSet) {
      return this.getSituationInSpanSet(textUntilCaret);
    }

    // Will happen only if user writes something that isn't really a tag selector
    return {
      type: 'UNKNOWN',
    };
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
    default:
      throw new Error(`Unexpected CompletionType: ${type}`);
  }
}

export type CompletionType = 'TAG_NAME' | 'TAG_VALUE' | 'KEYWORD' | 'OPERATOR' | 'SCOPE';
type Completion = {
  type: CompletionType;
  label: string;
  insertText: string;
};

export type Tag = {
  name: string;
  value: string;
};

export type Situation =
  | {
      type: 'UNKNOWN';
    }
  | {
      type: 'EMPTY';
    }
  | {
      type: 'SPANSET_EMPTY';
    }
  | {
      type: 'SPANSET_ONLY_DOT';
    }
  | {
      type: 'SPANSET_AFTER_NAME';
    }
  | {
      type: 'SPANSET_IN_NAME';
    }
  | {
      type: 'SPANSET_IN_NAME_SCOPE';
    }
  | {
      type: 'SPANSET_IN_VALUE';
      tagName: string;
      betweenQuotes: boolean;
    }
  | {
      type: 'SPANSET_AFTER_VALUE';
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
