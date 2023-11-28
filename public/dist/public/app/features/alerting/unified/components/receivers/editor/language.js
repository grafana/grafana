// these map to the builtin token types
var TokenType;
(function (TokenType) {
    TokenType["Delimiter"] = "delimiter";
    TokenType["Keyword"] = "keyword";
    TokenType["Function"] = "type.identifier";
    TokenType["String"] = "string";
    TokenType["Variable"] = "variable.name";
    TokenType["Number"] = "number";
    TokenType["Comment"] = "comment";
    TokenType["Operator"] = "operator";
    TokenType["Identifier"] = "idenfifier";
})(TokenType || (TokenType = {}));
// list of available functions in Alertmanager templates
// see https://cs.github.com/prometheus/alertmanager/blob/805e505288ce82c3e2b625a3ca63aaf2b0aa9cea/template/template.go?q=join#L132-L151
export var AlertmanagerTemplateFunction;
(function (AlertmanagerTemplateFunction) {
    AlertmanagerTemplateFunction["toUpper"] = "toUpper";
    AlertmanagerTemplateFunction["toLower"] = "toLower";
    AlertmanagerTemplateFunction["title"] = "title";
    AlertmanagerTemplateFunction["join"] = "join";
    AlertmanagerTemplateFunction["match"] = "match";
    AlertmanagerTemplateFunction["safeHtml"] = "safeHtml";
    AlertmanagerTemplateFunction["reReplaceAll"] = "reReplaceAll";
    AlertmanagerTemplateFunction["stringSlice"] = "stringSlice";
})(AlertmanagerTemplateFunction || (AlertmanagerTemplateFunction = {}));
export const availableAlertManagerFunctions = Object.values(AlertmanagerTemplateFunction);
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
export const language = {
    defaultToken: '',
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
export const conf = {
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
//# sourceMappingURL=language.js.map