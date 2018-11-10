/**
 * Provides a stateful means of managing placeholders in text.
 *
 * Placeholders are numbers prefixed with the `$` character (e.g. `$1`).
 * Each number value represents the order in which a placeholder should
 * receive focus if multiple placeholders exist.
 *
 * Example scenario given `sum($3 offset $1) by($2)`:
 * 1. `sum( offset |) by()`
 * 2. `sum( offset 1h) by(|)`
 * 3. `sum(| offset 1h) by (label)`
 */
export default class PlaceholdersBuffer {
  private nextMoveOffset: number;
  private orders: number[];
  private parts: string[];

  constructor(text: string) {
    const result = this.parse(text);
    const nextPlaceholderIndex = result.orders.length ? result.orders[0] : 0;
    this.nextMoveOffset = this.getOffsetBetween(result.parts, 0, nextPlaceholderIndex);
    this.orders = result.orders;
    this.parts = result.parts;
  }

  clearPlaceholders() {
    this.nextMoveOffset = 0;
    this.orders = [];
  }

  getNextMoveOffset(): number {
    return this.nextMoveOffset;
  }

  hasPlaceholders(): boolean {
    return this.orders.length > 0;
  }

  setNextPlaceholderValue(value: string) {
    if (this.orders.length === 0) {
      return;
    }
    const currentPlaceholderIndex = this.orders[0];
    this.parts[currentPlaceholderIndex] = value;
    this.orders = this.orders.slice(1);
    if (this.orders.length === 0) {
      this.nextMoveOffset = 0;
      return;
    }
    const nextPlaceholderIndex = this.orders[0];
    // Case should never happen but handle it gracefully in case
    if (currentPlaceholderIndex === nextPlaceholderIndex) {
      this.nextMoveOffset = 0;
      return;
    }
    const backwardMove = currentPlaceholderIndex > nextPlaceholderIndex;
    const indices = backwardMove
      ? { start: nextPlaceholderIndex + 1, end: currentPlaceholderIndex + 1 }
      : { start: currentPlaceholderIndex + 1, end: nextPlaceholderIndex };
    this.nextMoveOffset = (backwardMove ? -1 : 1) * this.getOffsetBetween(this.parts, indices.start, indices.end);
  }

  toString(): string {
    return this.parts.join('');
  }

  private getOffsetBetween(parts: string[], startIndex: number, endIndex: number) {
    return parts.slice(startIndex, endIndex).reduce((offset, part) => offset + part.length, 0);
  }

  private parse(text: string): ParseResult {
    const placeholderRegExp = /\$(\d+)/g;
    const parts = [];
    const orders = [];
    let textOffset = 0;
    while (true) {
      const match = placeholderRegExp.exec(text);
      if (!match) {
        break;
      }
      const part = text.slice(textOffset, match.index);
      parts.push(part);
      // Accounts for placeholders at text boundaries
      if (part !== '') {
        parts.push('');
      }
      const order = parseInt(match[1], 10);
      orders.push({ index: parts.length - 1, order });
      textOffset += part.length + match.length;
    }
    // Ensures string serialisation still works if no placeholders were parsed
    // and also accounts for the remainder of text with placeholders
    parts.push(text.slice(textOffset));
    return {
      // Placeholder values do not necessarily appear sequentially so sort the
      // indices to traverse in priority order
      orders: orders.sort((o1, o2) => o1.order - o2.order).map(o => o.index),
      parts,
    };
  }
}

type ParseResult = {
  /**
   * Indices to placeholder items in `parts` in traversal order.
   */
  orders: number[];
  /**
   * Parts comprising the original text with placeholders occupying distinct items.
   */
  parts: string[];
};
