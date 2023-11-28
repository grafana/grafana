export class LinkedToken {
    constructor(type, value, range, previous, next, tokenTypes) {
        this.type = type;
        this.value = value;
        this.range = range;
        this.previous = previous;
        this.next = next;
        this.tokenTypes = tokenTypes;
    }
    isKeyword() {
        return this.type === this.tokenTypes.Keyword;
    }
    isWhiteSpace() {
        return this.type === this.tokenTypes.Whitespace;
    }
    isParenthesis() {
        return this.type === this.tokenTypes.Parenthesis;
    }
    isIdentifier() {
        return this.type === this.tokenTypes.Identifier;
    }
    isString() {
        return this.type === this.tokenTypes.String;
    }
    isDoubleQuotedString() {
        return this.type === this.tokenTypes.Type;
    }
    isVariable() {
        return this.type === this.tokenTypes.Variable;
    }
    isFunction() {
        return this.type === this.tokenTypes.Function;
    }
    isNumber() {
        return this.type === this.tokenTypes.Number;
    }
    is(type, value) {
        const isType = this.type === type;
        return value !== undefined ? isType && this.value === value : isType;
    }
    endsWith(value) {
        return this.value === value || this.value[this.value.length - 1] === value;
    }
    getPreviousNonWhiteSpaceToken() {
        let curr = this.previous;
        while (curr != null) {
            if (!curr.isWhiteSpace()) {
                return curr;
            }
            curr = curr.previous;
        }
        return null;
    }
    getPreviousOfType(type, value) {
        let curr = this.previous;
        while (curr != null) {
            const isType = curr.type === type;
            if (value !== undefined ? isType && curr.value === value : isType) {
                return curr;
            }
            curr = curr.previous;
        }
        return null;
    }
    getPreviousUntil(type, ignoreTypes, value) {
        let tokens = [];
        let curr = this.previous;
        while (curr != null) {
            if (ignoreTypes.some((t) => t === (curr === null || curr === void 0 ? void 0 : curr.type))) {
                curr = curr.previous;
                continue;
            }
            const isType = curr.type === type;
            if (value !== undefined ? isType && curr.value === value : isType) {
                return tokens;
            }
            if (!curr.isWhiteSpace()) {
                tokens.push(curr);
            }
            curr = curr.previous;
        }
        return tokens;
    }
    getNextUntil(type, ignoreTypes, value) {
        let tokens = [];
        let curr = this.next;
        while (curr != null) {
            if (ignoreTypes.some((t) => t === (curr === null || curr === void 0 ? void 0 : curr.type))) {
                curr = curr.next;
                continue;
            }
            const isType = curr.type === type;
            if (value !== undefined ? isType && curr.value === value : isType) {
                return tokens;
            }
            if (!curr.isWhiteSpace()) {
                tokens.push(curr);
            }
            curr = curr.next;
        }
        return tokens;
    }
    getPreviousKeyword() {
        let curr = this.previous;
        while (curr != null) {
            if (curr.isKeyword()) {
                return curr;
            }
            curr = curr.previous;
        }
        return null;
    }
    getNextNonWhiteSpaceToken() {
        let curr = this.next;
        while (curr != null) {
            if (!curr.isWhiteSpace()) {
                return curr;
            }
            curr = curr.next;
        }
        return null;
    }
    getNextOfType(type, value) {
        let curr = this.next;
        while (curr != null) {
            const isType = curr.type === type;
            if (value !== undefined ? isType && curr.value === value : isType) {
                return curr;
            }
            curr = curr.next;
        }
        return null;
    }
}
//# sourceMappingURL=LinkedToken.js.map