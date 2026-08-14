import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

// these map to the builtin token types
enum TokenType {
  Delimiter = 'delimiter',
  Keyword = 'keyword',
  Function = 'type.identifier',
  String = 'string',
  Variable = 'variable.name',
  Number = 'number',
  Comment = 'comment',
  Operator = 'operator',
  Identifier = 'idenfifier',
}

// list of available functions in Alertmanager templates
// see https://cs.github.com/prometheus/alertmanager/blob/805e505288ce82c3e2b625a3ca63aaf2b0aa9cea/template/template.go?q=join#L132-L151
export enum AlertmanagerTemplateFunction {
  toUpper = 'toUpper',
  toLower = 'toLower',
  title = 'title',
  join = 'join',
  match = 'match',
  safeHtml = 'safeHtml',
  reReplaceAll = 'reReplaceAll',
  stringSlice = 'stringSlice',
}

// list of available Gomplate functions in Alertmanager templates
// see https://github.com/hairyhenderson/gomplate
export const GomplateFunctions = {
  coll: [
    {
      keyword: 'coll.Dict',
      definition:
        'Creates a map with string keys from key/value pairs. All keys are converted to strings. If an odd number of arguments is provided, the last is used as the key with an empty string value.',
      usage: 'function(key string, val any, ...)',
      example: `{{ coll.Dict "name" "Frank" "age" 42 | data.ToYAML }}`,
    },
    {
      keyword: 'coll.Slice',
      definition: 'Creates a slice (like an array or list). Useful when needing to range over a bunch of variables.',
      usage: 'function(in ...any)',
      example: `{{ range coll.Slice "Bart" "Lisa" "Maggie" }}Hello, {{ . }}{{ end }}`,
    },
    {
      keyword: 'coll.Append',
      definition: 'Appends a value to the end of a list. Creates a new list rather than modifying the input.',
      usage: 'function(value any, list []any)',
      example: `{{ coll.Slice 1 1 2 3 | append 5 }}`,
    },
  ],

  data: [
    {
      keyword: 'data.JSON',
      definition: 'Converts a JSON string into an object. Works for JSON Objects and Arrays.',
      usage: 'function(json string)',
      example: `{{ ($json | data.JSON).hello }}`,
    },
    {
      keyword: 'data.ToJSON',
      definition: 'Converts an object to a JSON document.',
      usage: 'function(obj any)',
      example: `{{ (\`{"foo":{"hello":"world"}}\` | json).foo | data.ToJSON }}`,
    },
    {
      keyword: 'data.ToJSONPretty',
      definition: 'Converts an object to a pretty-printed (indented) JSON document.',
      usage: 'function(indent string, obj any)',
      example: `{{ \`{"hello":"world"}\` | data.JSON | data.ToJSONPretty "  " }}`,
    },
  ],

  tmpl: [
    {
      keyword: 'tmpl.Exec',
      definition:
        'Execute (render) the named template. This is equivalent to using the `template` action, except the result is returned as a string. This allows for post-processing of templates.',
      usage: 'function(name string, [context any])',
      example: `{{ tmpl.Exec "T1" | strings.ToUpper }}`,
    },
    {
      keyword: 'tmpl.Inline',
      definition:
        'Render the given string as a template, just like a nested template. If the template is given a name, it can be re-used later with the `template` keyword. A context can be provided, otherwise the default gomplate context will be used.',
      usage: 'function(partial string, context any)',
      example: `{{ tmpl.Inline "{{print \`hello world\`}}" }}`,
    },
  ],

  time: [
    {
      keyword: 'time.Now',
      definition: "Returns the current local time, as a time.Time. This wraps Go's time.Now.",
      usage: 'function()',
      example: `{{ (time.Now).UTC.Format "Day 2 of month 1 in year 2006 (timezone MST)" }}`,
    },
  ],
};

export const availableAlertManagerFunctions = [
  ...Object.values(AlertmanagerTemplateFunction),
  ...Object.keys(GomplateFunctions).map((namespace) => namespace),
];

// boolean functions
const booleanFunctions = ['eq', 'ne', 'lt', 'le', 'gt', 'ge'];

// built-in functions for Go templates
export const builtinFunctions = [
  'and',
  'call',
  'html',
  'index',
  'slice',
  'js',
  'len',
  'not',
  'or',
  'print',
  'printf',
  'println',
  'urlquery',
  ...booleanFunctions,
];

// Go template keywords
export const keywords = ['define', 'if', 'else', 'end', 'range', 'break', 'continue', 'template', 'block', 'with'];

// Monarch language definition, see https://microsoft.github.io/monaco-editor/monarch.html
// check https://github.com/microsoft/monaco-editor/blob/main/src/basic-languages/go/go.ts for an example
// see https://pkg.go.dev/text/template for the available keywords etc
export const language: monacoType.languages.IMonarchLanguage = {
  defaultToken: '', // change this to "invalid" to find tokens that were never matched
  keywords: keywords,
  functions: [...builtinFunctions, ...availableAlertManagerFunctions],
  operators: ['|'],
  tokenizer: {
    root: [
      // strings
      [/"/, TokenType.String, '@string'],
      [/`/, TokenType.String, '@rawstring'],
      // numbers
      [/\d*\d+[eE]([\-+]?\d+)?/, 'number.float'],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F']*[0-9a-fA-F]/, 'number.hex'],
      [/0[0-7']*[0-7]/, 'number.octal'],
      [/0[bB][0-1']*[0-1]/, 'number.binary'],
      [/\d[\d']*/, TokenType.Number],
      [/\d/, TokenType.Number],
      // delimiter: after number because of .\d floats
      [/[;,.]/, TokenType.Delimiter],
      // delimiters
      [/{{-?/, TokenType.Delimiter],
      [/-?}}/, TokenType.Delimiter],
      // variables
      [/\.([A-Za-z]+)?/, TokenType.Variable],
      // identifiers and keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': { token: TokenType.Keyword },
            '@functions': { token: TokenType.Function },
            '@default': TokenType.Identifier,
          },
        },
      ],
      // comments
      [/\/\*.*\*\//, TokenType.Comment],
    ],
    string: [
      [/[^\\"]+/, TokenType.String],
      [/\\./, 'string.escape.invalid'],
      [/"/, TokenType.String, '@pop'],
    ],
    rawstring: [
      [/[^\`]/, TokenType.String],
      [/`/, TokenType.String, '@pop'],
    ],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  comments: {
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{{', '}}'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{{', close: '}}' },
    { open: '(', close: ')' },
    { open: '`', close: '`' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{{', close: '}}' },
    { open: '(', close: ')' },
    { open: '`', close: '`' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};
