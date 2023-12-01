import {
  delimitedIndent,
  indentNodeProp,
  foldNodeProp,
  foldInside,
  LRLanguage,
  LanguageSupport,
} from '@codemirror/language';

import { globalCompletion } from './complete';
import { parser } from './prql-lezer';

/// A language provider based on the [Lezer PRQL
/// parser](https://github.com/PRQL/prql/tree/main/grammars/prql-lezer), extended with
/// highlighting and indentation information.
export const prqlLanguage = LRLanguage.define({
  name: 'prql',
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        TupleExpression: delimitedIndent({ closing: '}' }),
        ArrayExpression: delimitedIndent({ closing: ']' }),
      }),
      foldNodeProp.add({
        'ArrayExpression TupleExpression': foldInside,
      }),
    ],
  }),
  languageData: {
    closeBrackets: {
      brackets: ['(', '[', '{', "'", '"', "'''", '"""'],
      stringPrefixes: ['f', 'r', 's'],
    },
    commentTokens: { line: '#' },
  },
});

/// PRQL language support.
export function prql() {
  return new LanguageSupport(prqlLanguage, [prqlLanguage.data.of({ autocomplete: globalCompletion })]);
}
