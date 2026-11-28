import { StreamLanguage, type StringStream } from '@codemirror/language';

type Context =
  | { kind: 'comment' | 'string' }
  | { kind: 'heredoc'; delimiter: string; indented: boolean }
  | { kind: 'template'; depth: number };

interface HclState {
  contexts: Context[];
}

const keywords = new Set(['for', 'in', 'if', 'else', 'endif', 'endfor']);

function tokenComment(stream: StringStream, state: HclState): string {
  if (stream.match(/^.*?\*\//)) {
    state.contexts.pop();
  } else {
    stream.skipToEnd();
  }
  return 'comment';
}

function tokenString(stream: StringStream, state: HclState, context: Context): string {
  if (context.kind === 'heredoc' && stream.sol()) {
    const line = context.indented ? stream.string.trimStart() : stream.string;
    if (line.trimEnd() === context.delimiter) {
      stream.skipToEnd();
      state.contexts.pop();
      return 'string';
    }
  }

  // Escaped template openers are literal text, including in heredocs.
  if (stream.match('$${') || stream.match('%%{')) {
    return 'string';
  }
  if (stream.match('${') || stream.match('%{')) {
    state.contexts.push({ kind: 'template', depth: 0 });
    return 'punctuation';
  }
  if (context.kind === 'string') {
    if (stream.eat('"')) {
      state.contexts.pop();
      return 'string';
    }
    if (stream.eat('\\')) {
      stream.next();
      return 'string';
    }
  }

  stream.next();
  stream.eatWhile(context.kind === 'string' ? /[^"\\$%]/ : /[^$%]/);
  return 'string';
}

function token(stream: StringStream, state: HclState): string | null {
  const context = state.contexts.at(-1);
  if (context?.kind === 'comment') {
    return tokenComment(stream, state);
  }
  if (context?.kind === 'string' || context?.kind === 'heredoc') {
    return tokenString(stream, state, context);
  }
  if (stream.eatSpace()) {
    return null;
  }
  if (stream.match('//') || stream.match('#')) {
    stream.skipToEnd();
    return 'comment';
  }
  if (stream.match('/*')) {
    state.contexts.push({ kind: 'comment' });
    return 'comment';
  }
  if (stream.eat('"')) {
    state.contexts.push({ kind: 'string' });
    return 'string';
  }

  const heredoc = stream.match(/^<<(-?)([\p{ID_Start}_][\p{ID_Continue}-]*)[ \t]*$/u);
  if (Array.isArray(heredoc)) {
    state.contexts.push({ kind: 'heredoc', delimiter: heredoc[2], indented: heredoc[1] === '-' });
    return 'string';
  }
  if (context?.kind === 'template') {
    if (stream.eat('{')) {
      context.depth++;
      return 'punctuation';
    }
    if (stream.eat('}')) {
      if (context.depth === 0) {
        state.contexts.pop();
      } else {
        context.depth--;
      }
      return 'punctuation';
    }
  }
  if (stream.match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)) {
    return 'number';
  }

  const identifier = stream.match(/^[\p{ID_Start}_][\p{ID_Continue}-]*/u);
  if (Array.isArray(identifier)) {
    if (stream.match(/^[ \t]*=(?!=)/, false)) {
      return 'propertyName';
    }
    if (identifier[0] === 'true' || identifier[0] === 'false') {
      return 'bool';
    }
    if (identifier[0] === 'null') {
      return 'null';
    }
    if (keywords.has(identifier[0])) {
      return 'keyword';
    }
    if (stream.match(/^[ \t]*\(/, false)) {
      return 'variableName.function';
    }
    if (stream.match(/^[ \t]*(?:"|\{)/, false)) {
      return 'typeName';
    }
    return 'variableName';
  }
  if (stream.match(/^[=><!?:&|+\-*/%~]+/)) {
    return 'operator';
  }

  stream.next();
  return 'punctuation';
}

export const hclLanguage = StreamLanguage.define<HclState>({
  name: 'hcl',
  startState: () => ({ contexts: [] }),
  // Template brace depths must not be shared with earlier parser checkpoints.
  copyState: (state) => ({ contexts: state.contexts.map((context) => ({ ...context })) }),
  token,
  languageData: { commentTokens: { line: '#', block: { open: '/*', close: '*/' } } },
});
