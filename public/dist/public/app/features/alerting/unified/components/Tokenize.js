import { css } from '@emotion/css';
import React from 'react';
import { Badge, useStyles2 } from '@grafana/ui';
import { HoverCard } from './HoverCard';
import { keywords as KEYWORDS, builtinFunctions as FUNCTIONS } from './receivers/editor/language';
const VARIABLES = ['$', '.', '"'];
function Tokenize({ input, delimiter = ['{{', '}}'] }) {
    const styles = useStyles2(getStyles);
    const [open, close] = delimiter;
    /**
     * This RegExp uses 2 named capture groups, text that comes before the token and the token itself
     *
     *  <before> open  <token>  close
     *  ───────── ── ─────────── ──
     *  Some text {{ $labels.foo }}
     */
    const regex = new RegExp(`(?<before>.*?)(${open}(?<token>.*?)${close}|$)`, 'gm');
    const lines = input.split('\n');
    const output = [];
    lines.forEach((line, lineIndex) => {
        const matches = Array.from(line.matchAll(regex));
        matches.forEach((match, matchIndex) => {
            var _a, _b, _c;
            const before = (_a = match.groups) === null || _a === void 0 ? void 0 : _a.before;
            const token = (_c = (_b = match.groups) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.trim();
            if (before) {
                output.push(React.createElement("span", { key: `${lineIndex}-${matchIndex}-before` }, before));
            }
            if (token) {
                const type = tokenType(token);
                const description = type === TokenType.Variable ? token : '';
                const tokenContent = `${open} ${token} ${close}`;
                output.push(React.createElement(Token, { key: `${lineIndex}-${matchIndex}-token`, content: tokenContent, type: type, description: description }));
            }
        });
        output.push(React.createElement("br", { key: `${lineIndex}-newline` }));
    });
    return React.createElement("span", { className: styles.wrapper }, output);
}
var TokenType;
(function (TokenType) {
    TokenType["Variable"] = "variable";
    TokenType["Function"] = "function";
    TokenType["Keyword"] = "keyword";
    TokenType["Unknown"] = "unknown";
})(TokenType || (TokenType = {}));
function Token({ content, description, type }) {
    const styles = useStyles2(getStyles);
    const disableCard = Boolean(type) === false;
    return (React.createElement(HoverCard, { placement: "top-start", disabled: disableCard, content: React.createElement("div", { className: styles.hoverTokenItem },
            React.createElement(Badge, { tabIndex: 0, text: React.createElement(React.Fragment, null, type), color: 'blue' }),
            " ",
            description && React.createElement("code", null, description)) },
        React.createElement("span", null,
            React.createElement(Badge, { tabIndex: 0, className: styles.token, text: content, color: 'blue' }))));
}
function isVariable(input) {
    return VARIABLES.some((character) => input.startsWith(character));
}
function isKeyword(input) {
    return KEYWORDS.some((keyword) => input.startsWith(keyword));
}
function isFunction(input) {
    return FUNCTIONS.some((functionName) => input.startsWith(functionName));
}
function tokenType(input) {
    let tokenType;
    if (isVariable(input)) {
        tokenType = TokenType.Variable;
    }
    else if (isKeyword(input)) {
        tokenType = TokenType.Keyword;
    }
    else if (isFunction(input)) {
        tokenType = TokenType.Function;
    }
    else {
        tokenType = TokenType.Unknown;
    }
    return tokenType;
}
const getStyles = (theme) => ({
    wrapper: css `
    white-space: pre-wrap;
  `,
    token: css `
    cursor: default;
    font-family: ${theme.typography.fontFamilyMonospace};
  `,
    popover: css `
    border-radius: ${theme.shape.radius.default};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};

    padding: ${theme.spacing(1)};
  `,
    hoverTokenItem: css `
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
});
export { Tokenize, Token };
//# sourceMappingURL=Tokenize.js.map