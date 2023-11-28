import { SelectableValue } from '@grafana/data';
import type { Monaco, monacoTypes } from '@grafana/ui';

import TempoLanguageProvider from '../../language_provider';

interface Props {
  languageProvider: TempoLanguageProvider;
}

/**
 * Class that implements CompletionItemProvider interface and allows us to provide suggestion for the Monaco
 * autocomplete system.
 */
export class CompletionProvider implements monacoTypes.languages.CompletionItemProvider {
  languageProvider: TempoLanguageProvider;

  constructor(props: Props) {
    this.languageProvider = props.languageProvider;
  }

  triggerCharacters = ['=', ' '];

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
        };
        return suggestion;
      });
      return { suggestions };
    });
  }

  private async getTagValues(tagName: string): Promise<Array<SelectableValue<string>>> {
    let tagValues: Array<SelectableValue<string>>;

    if (this.cachedValues.hasOwnProperty(tagName)) {
      tagValues = this.cachedValues[tagName];
    } else {
      tagValues = await this.languageProvider.getOptionsV1(tagName);
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
        return this.getTagsCompletions();
      }
      case 'IN_NAME':
        return this.getTagsCompletions();
      case 'IN_VALUE':
        const tagValues = await this.getTagValues(situation.tagName);
        const items: Completion[] = [];

        const getInsertionText = (val: SelectableValue<string>): string => `"${val.label}"`;

        tagValues.forEach((val) => {
          if (val?.label) {
            items.push({
              label: val.label,
              insertText: getInsertionText(val),
              type: 'TAG_VALUE',
            });
          }
        });
        return items;
      default:
        throw new Error(`Unexpected situation ${situation}`);
    }
  }

  private getTagsCompletions(): Completion[] {
    const tags = this.languageProvider.getAutocompleteTags();
    return tags
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'accent' }))
      .map((key) => ({
        label: key,
        insertText: key,
        type: 'TAG_NAME',
      }));
  }

  /**
   * Figure out where is the cursor and what kind of suggestions are appropriate.
   * @param text
   * @param offset
   */
  private getSituation(text: string, offset: number): Situation {
    if (text === '' || offset === 0 || text[text.length - 1] === ' ') {
      return {
        type: 'EMPTY',
      };
    }

    const textUntilCaret = text.substring(0, offset);

    const regex = /(?<key>[^= ]+)(?<equals>=)?(?<value>([^ "]+)|"([^"]*)")?/;
    const matches = textUntilCaret.match(new RegExp(regex, 'g'));

    if (matches?.length) {
      const last = matches[matches.length - 1];
      const lastMatched = last.match(regex);
      if (lastMatched) {
        const key = lastMatched.groups?.key;
        const equals = lastMatched.groups?.equals;

        if (!key) {
          return {
            type: 'EMPTY',
          };
        }

        if (!equals) {
          return {
            type: 'IN_NAME',
          };
        }

        return {
          type: 'IN_VALUE',
          tagName: key,
        };
      }
    }

    return {
      type: 'EMPTY',
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
      type: 'IN_NAME';
    }
  | {
      type: 'IN_VALUE';
      tagName: string;
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
