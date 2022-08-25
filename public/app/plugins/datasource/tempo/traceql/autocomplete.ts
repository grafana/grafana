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
  private intrinsics: string[] = ['name', 'status', 'duration'];
  // private scopes: string[] = ['span', 'resource'];
  private operators: string[] = ['=', '-', '+', '<', '>', '>=', '<='];
  private logicalOps: string[] = ['&&', '||'];

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
        return this.getKeywordsAndTagsCompletions();
      }
      case 'SPANSET_IN_NAME':
        return this.getKeywordsAndTagsCompletions();
      case 'SPANSET_AFTER_NAME':
        return this.operators.map((key) => ({
          label: key,
          insertText: key,
          type: 'OPERATOR' as CompletionType,
        }));
      case 'SPANSET_IN_VALUE':
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
      case 'SPANSET_AFTER_VALUE':
        return this.logicalOps.concat('}').map((key) => ({
          label: key,
          insertText: key,
          type: 'OPERATOR' as CompletionType,
        }));
      default:
        throw new Error(`Unexpected situation ${situation}`);
    }
  }

  private getKeywordsAndTagsCompletions(): Completion[] {
    const result: Completion[] = [];
    result.push(
      ...this.intrinsics.map((key) => ({
        label: key,
        insertText: key,
        type: 'KEYWORD' as CompletionType,
      }))
    );
    result.push(
      ...Object.keys(this.tags).map((key) => ({
        label: key,
        insertText: key,
        type: 'TAG_NAME' as CompletionType,
      }))
    );
    return result;
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
    default:
      throw new Error(`Unexpected CompletionType: ${type}`);
  }
}

export type CompletionType = 'TAG_NAME' | 'TAG_VALUE' | 'KEYWORD' | 'OPERATOR';
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
      type: 'SPANSET_AFTER_NAME';
    }
  | {
      type: 'SPANSET_IN_NAME';
    }
  | {
      type: 'SPANSET_IN_VALUE';
      tagName: string;
      betweenQuotes: boolean;
    }
  | {
      type: 'SPANSET_AFTER_VALUE';
    };

/**
 * Figure out where is the cursor and what kind of suggestions are appropriate.
 * As currently TraceQL handles just a simple {foo="bar", baz="zyx"} kind of values we can do with simple regex to figure
 * out where we are with the cursor.
 * @param text
 * @param offset
 */
function getSituation(text: string, offset: number): Situation {
  if (text === '' || offset === 0) {
    return {
      type: 'EMPTY',
    };
  }

  const textUntilCaret = text.substring(0, offset);

  // Check if we're inside a span set
  let isInSpanSet = textUntilCaret.lastIndexOf('{') > textUntilCaret.lastIndexOf('}');
  if (isInSpanSet) {
    return getSituationInSpanSet(textUntilCaret);
  }

  // Will happen only if user writes something that isn't really a tag selector
  return {
    type: 'UNKNOWN',
  };
}

function getSituationInSpanSet(textUntilCaret: string): Situation {
  const matched = textUntilCaret.match(
    /([\s{])((?<name>[\w./]+)(?<space1>\s*)((?<op>[!=+\-<>]+)(?<space2>\s*)(?<value>(?<open_bracket>")?[\w.]+(?<close_bracket>")?)?)?)(?<space3>\s*)$/
  );

  if (matched) {
    const name = matched.groups?.name;
    const op = matched.groups?.op;
    const value = matched.groups?.value;

    console.log({ name, op, value, matched });

    if (!name) {
      return {
        type: 'EMPTY',
      };
    }

    if (!op) {
      return {
        type: matched.groups?.space1 ? 'SPANSET_AFTER_NAME' : 'SPANSET_IN_NAME',
      };
    }

    if (matched.groups?.space3) {
      return {
        type: 'SPANSET_AFTER_VALUE',
      };
    }
    return {
      type: 'SPANSET_IN_VALUE',
      tagName: name,
      betweenQuotes: !!matched.groups?.open_bracket,
    };
  } else {
    console.log('matched is null');
  }

  return {
    type: 'EMPTY',
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
