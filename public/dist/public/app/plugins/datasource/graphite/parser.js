import { Lexer } from './lexer';
import { isGraphiteParserError } from './utils';
export class Parser {
    constructor(expression) {
        this.expression = expression;
        this.lexer = new Lexer(expression);
        this.tokens = this.lexer.tokenize();
        this.index = 0;
    }
    getAst() {
        return this.start();
    }
    start() {
        try {
            return this.functionCall() || this.metricExpression();
        }
        catch (e) {
            if (isGraphiteParserError(e)) {
                return {
                    type: 'error',
                    message: e.message,
                    pos: e.pos,
                };
            }
        }
        return null;
    }
    curlyBraceSegment() {
        if (this.match('identifier', '{') || this.match('{')) {
            let curlySegment = '';
            while (!this.match('') && !this.match('}')) {
                curlySegment += this.consumeToken().value;
            }
            if (!this.match('}')) {
                this.errorMark("Expected closing '}'");
            }
            curlySegment += this.consumeToken().value;
            // if curly segment is directly followed by identifier
            // include it in the segment
            if (this.match('identifier')) {
                curlySegment += this.consumeToken().value;
            }
            return {
                type: 'segment',
                value: curlySegment,
            };
        }
        else {
            return null;
        }
    }
    metricSegment() {
        const curly = this.curlyBraceSegment();
        if (curly) {
            return curly;
        }
        if (this.match('identifier') || this.match('number') || this.match('bool')) {
            // hack to handle float numbers in metric segments
            const tokenValue = this.consumeToken().value;
            const parts = tokenValue && typeof tokenValue === 'string' ? tokenValue.split('.') : '';
            if (parts.length === 2) {
                this.tokens.splice(this.index, 0, { type: '.' });
                this.tokens.splice(this.index + 1, 0, {
                    type: 'number',
                    value: parts[1],
                });
            }
            return {
                type: 'segment',
                value: parts[0],
            };
        }
        if (!this.match('templateStart')) {
            this.errorMark('Expected metric identifier');
        }
        this.consumeToken();
        if (!this.match('identifier')) {
            this.errorMark('Expected identifier after templateStart');
        }
        const node = {
            type: 'template',
            value: this.consumeToken().value,
        };
        if (!this.match('templateEnd')) {
            this.errorMark('Expected templateEnd');
        }
        this.consumeToken();
        return node;
    }
    metricExpression() {
        if (!this.match('templateStart') && !this.match('identifier') && !this.match('number') && !this.match('{')) {
            return null;
        }
        const node = {
            type: 'metric',
            segments: [],
        };
        const segments = this.metricSegment();
        if (node.segments && segments) {
            node.segments.push(segments);
        }
        while (this.match('.')) {
            this.consumeToken();
            const segment = this.metricSegment();
            if (!segment) {
                this.errorMark('Expected metric identifier');
            }
            if (node.segments && segment) {
                node.segments.push(segment);
            }
        }
        return node;
    }
    functionCall() {
        if (!this.match('identifier', '(')) {
            return null;
        }
        let name = '';
        const token = this.consumeToken();
        if (typeof token.value === 'string') {
            name = token.value;
        }
        const node = {
            type: 'function',
            name: name,
        };
        // consume left parenthesis
        this.consumeToken();
        node.params = this.functionParameters();
        if (!this.match(')')) {
            this.errorMark('Expected closing parenthesis');
        }
        this.consumeToken();
        return node;
    }
    boolExpression() {
        if (!this.match('bool')) {
            return null;
        }
        return {
            type: 'bool',
            value: this.consumeToken().value === 'true',
        };
    }
    functionParameters() {
        if (this.match(')') || this.match('')) {
            return [];
        }
        const param = this.functionCall() ||
            this.numericLiteral() ||
            this.seriesRefExpression() ||
            this.boolExpression() ||
            this.metricExpression() ||
            this.stringLiteral();
        if (!this.match(',') && param) {
            return [param];
        }
        this.consumeToken();
        if (param) {
            return [param].concat(this.functionParameters());
        }
        return [];
    }
    seriesRefExpression() {
        if (!this.match('identifier')) {
            return null;
        }
        const value = this.tokens[this.index].value;
        if (value && typeof value === 'string' && !value.match(/\#[A-Z]/)) {
            return null;
        }
        const token = this.consumeToken();
        return {
            type: 'series-ref',
            value: token.value,
        };
    }
    numericLiteral() {
        if (!this.match('number')) {
            return null;
        }
        const token = this.consumeToken();
        if (token && token.value && typeof token.value === 'string') {
            return {
                type: 'number',
                value: parseFloat(token.value),
            };
        }
        return null;
    }
    stringLiteral() {
        if (!this.match('string')) {
            return null;
        }
        const token = this.consumeToken();
        if (token.isUnclosed && token.pos) {
            const error = {
                message: 'Unclosed string parameter',
                pos: token.pos,
            };
            throw error;
        }
        return {
            type: 'string',
            value: token.value,
        };
    }
    errorMark(text) {
        const currentToken = this.tokens[this.index];
        const type = currentToken ? currentToken.type : 'end of string';
        const error = {
            message: text + ' instead found ' + type,
            pos: currentToken && currentToken.pos ? currentToken.pos : this.lexer.char,
        };
        throw error;
    }
    // returns token value and incre
    consumeToken() {
        this.index++;
        return this.tokens[this.index - 1];
    }
    matchToken(type, index) {
        const token = this.tokens[this.index + index];
        return (token === undefined && type === '') || (token && token.type === type);
    }
    match(token1, token2) {
        return this.matchToken(token1, 0) && (!token2 || this.matchToken(token2, 1));
    }
}
//# sourceMappingURL=parser.js.map