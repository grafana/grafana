import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  autocompletion,
  snippetCompletion,
} from '@codemirror/autocomplete';
import { LanguageSupport, StreamLanguage, type StringStream, ensureSyntaxTree } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import { renderMarkdown } from '@grafana/data';

import { getAlertManagerSuggestions, getGomplateSuggestions } from './alertManagerSuggestions';
import { GomplateFunctions, availableAlertManagerFunctions, builtinFunctions, keywords } from './language';
import { type SuggestionDefinition } from './suggestionDefinition';
import {
  getAlertSuggestions,
  getAlertsSuggestions,
  getGlobalSuggestions,
  getKeyValueSuggestions,
  getSnippetsSuggestions,
} from './templateDataSuggestions';

interface TemplateState {
  expression: boolean;
  quote: string | null;
  comment: boolean;
}

function stringToken(stream: StringStream, state: TemplateState) {
  if (stream.eol() && state.quote !== '`') {
    state.quote = null;
    // Recover at the next action after a quoted string runs past its line.
    state.expression = false;
    return 'templateInvalidString';
  }
  return 'templateString';
}

const functions = new Set([
  ...builtinFunctions,
  ...availableAlertManagerFunctions,
  ...Object.values(GomplateFunctions).flatMap((items) => items.map((item) => item.keyword)),
]);

const language = StreamLanguage.define<TemplateState>({
  name: 'alerting-go-template',
  // Completion context needs adjacent closing and opening actions to stay separate.
  mergeTokens: false,
  startState: () => ({ expression: false, quote: null, comment: false }),
  token(stream, state) {
    if (state.comment) {
      if (stream.match('*/')) {
        state.comment = false;
        return 'templateCommentEnd';
      }
      while (!stream.eol() && !stream.match('*/', false)) {
        stream.next();
      }
      return 'templateComment';
    }

    if (state.quote) {
      if (stream.match(state.quote)) {
        state.quote = null;
        return 'templateStringEnd';
      }
      while (!stream.eol() && stream.peek() !== state.quote) {
        if (stream.next() === '\\' && state.quote !== '`') {
          stream.next();
        }
      }
      return stringToken(stream, state);
    }

    if (!state.expression) {
      if (stream.match(/{{-?/)) {
        state.expression = true;
        return 'templateDelimiter';
      }
      while (!stream.eol() && !stream.match('{{', false)) {
        stream.next();
      }
      return null;
    }

    if (stream.match(/-?}}/)) {
      state.expression = false;
      return 'templateDelimiter';
    }
    if (stream.eatSpace()) {
      return null;
    }
    if (stream.match('/*')) {
      state.comment = true;
      return 'templateComment';
    }
    if (stream.match(/["'`]/)) {
      state.quote = stream.current();
      return stringToken(stream, state);
    }
    if (stream.match(/(?:0[xX][\da-fA-F']+|0[bB][01']+|\d[\d']*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)) {
      return 'number';
    }
    if (stream.match(/\$\w*|\.\w*/)) {
      return 'variableName';
    }
    const word = stream.match(/[A-Za-z_]\w*(?:\.\w+)?/);
    if (word && typeof word !== 'boolean') {
      if (keywords.includes(word[0])) {
        return 'keyword';
      }
      return functions.has(word[0]) ? 'variableName.function' : 'variableName';
    }
    return stream.next() === '|' ? 'operator' : 'punctuation';
  },
  tokenTable: {
    templateDelimiter: tags.brace,
    templateString: tags.string,
    templateStringEnd: tags.string,
    templateInvalidString: tags.string,
    templateComment: tags.comment,
    templateCommentEnd: tags.comment,
  },
  languageData: {
    commentTokens: { block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"', "'", '`'] },
    autocomplete: completeGoTemplate,
  },
});

function templateContext(context: CompletionContext): 'expression' | 'text' | null {
  const tree = ensureSyntaxTree(context.state, context.pos, 50);
  if (!tree) {
    return null;
  }

  // Stream languages have a flat tree. Walk back to the last delimiter so strings
  // and comments containing braces cannot change the completion context.
  let node = tree.topNode.childBefore(context.pos);
  while (node) {
    if (node.name === 'templateDelimiter') {
      const isOpening = context.state.sliceDoc(node.from, node.from + 2) === '{{';
      return isOpening && context.pos >= node.to ? 'expression' : 'text';
    }
    if (node.name === 'templateString' || node.name === 'templateComment') {
      return null;
    }
    if (node.name === 'templateInvalidString') {
      return context.pos > node.to ? 'text' : null;
    }
    if (node.name === 'templateStringEnd' || node.name === 'templateCommentEnd') {
      return node.to <= context.pos ? 'expression' : null;
    }
    node = node.prevSibling;
  }
  return 'text';
}

function toCompletion(definition: SuggestionDefinition): Completion {
  const { label, detail, documentation, kind, insertText, insertAsSnippet } = definition;
  const name = typeof label === 'string' ? label : label.label;
  const description = typeof label === 'string' ? detail : (label.description ?? detail);
  const markdown = typeof documentation === 'string' ? documentation : documentation?.value;
  const completion: Completion = {
    label: name,
    detail: [typeof label === 'string' ? undefined : label.detail, description].filter(Boolean).join(' '),
    type: kind === 'field' ? 'property' : kind,
    apply: insertText ?? name,
    info: markdown
      ? () => {
          const element = document.createElement('div');
          element.innerHTML = renderMarkdown(markdown);
          return element;
        }
      : undefined,
  };
  return insertAsSnippet ? snippetCompletion(insertText ?? name, completion) : completion;
}

function completeGoTemplate(context: CompletionContext): CompletionResult | null {
  const location = templateContext(context);
  if (!location) {
    return null;
  }

  const word = context.matchBefore(/\w*$/)!;
  let from = word.from;
  let definitions: SuggestionDefinition[];

  if (location === 'text') {
    if (!context.explicit && !word.text) {
      return null;
    }
    definitions = getSnippetsSuggestions();
  } else {
    const reference = context.matchBefore(/[$\w.]+$/);
    const namespace = reference?.text.split('.')[0];
    if (namespace && Object.hasOwn(GomplateFunctions, namespace)) {
      from = reference!.from;
      definitions = getGomplateSuggestions();
    } else if (reference?.text.includes('.')) {
      const parent = reference.text.split('.').at(-2);
      switch (parent) {
        case '':
        case '$':
          definitions = [...getGlobalSuggestions(), ...getAlertSuggestions()];
          break;
        case 'Alerts':
          definitions = getAlertsSuggestions();
          break;
        case 'GroupLabels':
        case 'CommonLabels':
        case 'CommonAnnotations':
        case 'Labels':
        case 'Annotations':
          definitions = getKeyValueSuggestions();
          break;
        default:
          return null;
      }
    } else {
      if (!context.explicit && !word.text) {
        return null;
      }
      definitions = [...getAlertManagerSuggestions(), ...getGomplateSuggestions()];
    }
  }

  return { from, to: context.pos, options: definitions.map(toCompletion), validFor: /^\w*$/ };
}

/** Dynamically import this module with the template editor's lazy CodeMirror implementation. */
export function goTemplate(): LanguageSupport {
  return new LanguageSupport(language, autocompletion());
}
