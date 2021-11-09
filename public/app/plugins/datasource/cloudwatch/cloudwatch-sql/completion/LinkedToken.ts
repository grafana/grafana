import { monacoTypes } from '@grafana/ui';
import { TokenType } from './types';

export class LinkedToken {
  constructor(
    public type: string,
    public value: string,
    public range: monacoTypes.IRange,
    public previous: LinkedToken | null,
    public next: LinkedToken | null
  ) {}

  isKeyword(): boolean {
    return this.type === TokenType.Keyword;
  }

  isWhiteSpace(): boolean {
    return this.type === TokenType.Whitespace;
  }

  isParenthesis(): boolean {
    return this.type === TokenType.Parenthesis;
  }

  isIdentifier(): boolean {
    return this.type === TokenType.Identifier;
  }

  isString(): boolean {
    return this.type === TokenType.String;
  }

  isDoubleQuotedString(): boolean {
    return this.type === TokenType.Type;
  }

  isVariable(): boolean {
    return this.type === TokenType.Variable;
  }

  isFunction(): boolean {
    return this.type === TokenType.Function;
  }

  is(type: TokenType, value?: string | number | boolean): boolean {
    const isType = this.type === type;
    return value !== undefined ? isType && this.value === value : isType;
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

  getPreviousOfType(type: TokenType, value?: string): LinkedToken | null {
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

  getPreviousUntil(type: TokenType, ignoreTypes: TokenType[], value?: string): LinkedToken[] | null {
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

  getNextUntil(type: TokenType, ignoreTypes: TokenType[], value?: string): LinkedToken[] | null {
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

  getNextOfType(type: TokenType, value?: string): LinkedToken | null {
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
