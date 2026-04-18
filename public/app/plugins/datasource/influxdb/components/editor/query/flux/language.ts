import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

export const language: monacoType.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenizer: {
    root: [
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      [/\/\/.*$/, 'comment'],
    ],
    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
  },
};
