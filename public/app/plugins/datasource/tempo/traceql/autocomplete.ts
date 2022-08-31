import type { Monaco, monacoTypes } from '@grafana/ui';

import TempoLanguageProvider from '../language_provider';

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

  triggerCharacters = ['{', ',', '[', '(', '=', '~', ' ', '"'];

  // We set these directly and ae required for the provider to function.
  monaco: Monaco | undefined;
  editor: monacoTypes.editor.IStandaloneCodeEditor | undefined;

  private tags: { [tag: string]: Set<string> } = {};

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
    const completionItems = this.getCompletions(situation);

    return completionItems.then((items) => {
      // monaco by-default alphabetically orders the items.
      // to stop it, we use a number-as-string sortkey,
      // so that monaco keeps the order we use
      const maxIndexDigits = items.length.toString().length;
      const suggestions: monacoTypes.languages.CompletionItem[] = items.map((item, index) => ({
        kind: getMonacoCompletionItemKind(item.type, this.monaco!),
        label: item.label,
        insertText: item.insertText,
        sortText: index.toString().padStart(maxIndexDigits, '0'), // to force the order we have
        range,
      }));
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
        return Object.keys(this.tags).map((key) => {
          return {
            label: key,
            insertText: `{${key}="`,
            type: 'TAG_NAME',
          };
        });
      }
      case 'IN_TAG_NAME':
        return Object.keys(this.tags).map((key) => {
          return {
            label: key,
            insertText: key,
            type: 'TAG_NAME',
          };
        });
      case 'IN_TAG_VALUE':
        return await this.languageProvider.getOptions(situation.tagName).then((res) => {
          const items: Completion[] = [];
          res.forEach((val) => {
            if (val?.label) {
              items.push({
                label: val.label,
                insertText: situation.betweenQuotes ? val.label : `"${val.label}"`,
                type: 'TAG_VALUE',
              });
            }
          });
          return items;
        });
      default:
        throw new Error(`Unexpected situation ${situation}`);
    }
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
    case 'TAG_VALUE':
      return monaco.languages.CompletionItemKind.EnumMember;
    default:
      throw new Error(`Unexpected CompletionType: ${type}`);
  }
}

export type CompletionType = 'TAG_NAME' | 'TAG_VALUE';
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
      type: 'IN_TAG_NAME';
      otherTags: Tag[];
    }
  | {
      type: 'IN_TAG_VALUE';
      tagName: string;
      betweenQuotes: boolean;
      otherTags: Tag[];
    };

/**
 * Figure out where is the cursor and what kind of suggestions are appropriate.
 * As currently TraceQL handles just a simple {foo="bar", baz="zyx"} kind of values we can do with simple regex to figure
 * out where we are with the cursor.
 * @param text
 * @param offset
 */
function getSituation(text: string, offset: number): Situation {
  if (text === '') {
    return {
      type: 'EMPTY',
    };
  }

  // Get all the tags so far in the query so we can do some more filtering.
  const matches = text.matchAll(/(\w+)="(\w+)"/g);
  const existingTags = Array.from(matches).reduce((acc, match) => {
    const [_, name, value] = match[1];
    acc.push({ name, value });
    return acc;
  }, [] as Tag[]);

  // Check if we are editing a tag value right now. If so also get name of the tag
  const matchTagValue = text.substring(0, offset).match(/([\w.]+)=("?)[^"]*$/);
  if (matchTagValue) {
    return {
      type: 'IN_TAG_VALUE',
      tagName: matchTagValue[1],
      betweenQuotes: !!matchTagValue[2],
      otherTags: existingTags,
    };
  }

  // Check if we are editing a tag name
  const matchTagName = text.substring(0, offset).match(/[{,]\s*[^"]*$/);
  if (matchTagName) {
    return {
      type: 'IN_TAG_NAME',
      otherTags: existingTags,
    };
  }

  // Will happen only if user writes something that isn't really a tag selector
  return {
    type: 'UNKNOWN',
  };
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
