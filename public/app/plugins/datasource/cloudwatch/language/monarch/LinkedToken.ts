import { monacoTypes } from '@grafana/ui';

import { TokenTypes } from './types';

export class LinkedToken {
  constructor(
    public type: string,
    public value: string,
    public range: monacoTypes.IRange,
    public previous: LinkedToken | null,
    public next: LinkedToken | null,
    public tokenTypes: TokenTypes
  ) {}

  isKeyword(): boolean {
    return this.type === this.tokenTypes.Keyword;
  }

  isWhiteSpace(): boolean {
    return this.type === this.tokenTypes.Whitespace;
  }

  isParenthesis(): boolean {
    return this.type === this.tokenTypes.Parenthesis;
  }

  isIdentifier(): boolean {
    return this.type === this.tokenTypes.Identifier;
  }

  isString(): boolean {
    return this.type === this.tokenTypes.String;
  }

  isDoubleQuotedString(): boolean {
    return this.type === this.tokenTypes.Type;
  }

  isVariable(): boolean {
    return this.type === this.tokenTypes.Variable;
  }

  isFunction(): boolean {
    return this.type === this.tokenTypes.Function;
  }

  isNumber(): boolean {
    return this.type === this.tokenTypes.Number;
  }

  is(type: string, value?: string | number | boolean): boolean {
    const isType = this.type === type;
    return value !== undefined ? isType && this.value === value : isType;
  }

  endsWith(value: string | number | boolean): boolean {
    return this.value === value || this.value[this.value.length - 1] === value;
  }

  getPreviousNonWhiteSpaceToken(): LinkedToken | null {
    let curr = this.previous;
    while (curr != null) {
      if (!curr.isWhiteSpace()) {
        return curr;
      }
      curr = curr.previous;
    }
    return null;
  }

  getPreviousOfType(type: string, value?: string): LinkedToken | null {
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

  getPreviousUntil(type: string, ignoreTypes: string[], value?: string): LinkedToken[] | null {
    let tokens: LinkedToken[] = [];
    let curr = this.previous;
    while (curr != null) {
      if (ignoreTypes.some((t) => t === curr?.type)) {
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

  getNextUntil(type: string, ignoreTypes: string[], value?: string): LinkedToken[] | null {
    let tokens: LinkedToken[] = [];
    let curr = this.next;
    while (curr != null) {
      if (ignoreTypes.some((t) => t === curr?.type)) {
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

  getPreviousKeyword(): LinkedToken | null {
    let curr = this.previous;
    while (curr != null) {
      if (curr.isKeyword()) {
        return curr;
      }
      curr = curr.previous;
    }
    return null;
  }

  getNextNonWhiteSpaceToken(): LinkedToken | null {
    let curr = this.next;
    while (curr != null) {
      if (!curr.isWhiteSpace()) {
        return curr;
      }
      curr = curr.next;
    }
    return null;
  }

  getNextOfType(type: string, value?: string): LinkedToken | null {
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
