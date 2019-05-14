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
var PlaceholdersBuffer = /** @class */ (function () {
    function PlaceholdersBuffer(text) {
        var result = this.parse(text);
        var nextPlaceholderIndex = result.orders.length ? result.orders[0] : 0;
        this.nextMoveOffset = this.getOffsetBetween(result.parts, 0, nextPlaceholderIndex);
        this.orders = result.orders;
        this.parts = result.parts;
    }
    PlaceholdersBuffer.prototype.clearPlaceholders = function () {
        this.nextMoveOffset = 0;
        this.orders = [];
    };
    PlaceholdersBuffer.prototype.getNextMoveOffset = function () {
        return this.nextMoveOffset;
    };
    PlaceholdersBuffer.prototype.hasPlaceholders = function () {
        return this.orders.length > 0;
    };
    PlaceholdersBuffer.prototype.setNextPlaceholderValue = function (value) {
        if (this.orders.length === 0) {
            return;
        }
        var currentPlaceholderIndex = this.orders[0];
        this.parts[currentPlaceholderIndex] = value;
        this.orders = this.orders.slice(1);
        if (this.orders.length === 0) {
            this.nextMoveOffset = 0;
            return;
        }
        var nextPlaceholderIndex = this.orders[0];
        // Case should never happen but handle it gracefully in case
        if (currentPlaceholderIndex === nextPlaceholderIndex) {
            this.nextMoveOffset = 0;
            return;
        }
        var backwardMove = currentPlaceholderIndex > nextPlaceholderIndex;
        var indices = backwardMove
            ? { start: nextPlaceholderIndex + 1, end: currentPlaceholderIndex + 1 }
            : { start: currentPlaceholderIndex + 1, end: nextPlaceholderIndex };
        this.nextMoveOffset = (backwardMove ? -1 : 1) * this.getOffsetBetween(this.parts, indices.start, indices.end);
    };
    PlaceholdersBuffer.prototype.toString = function () {
        return this.parts.join('');
    };
    PlaceholdersBuffer.prototype.getOffsetBetween = function (parts, startIndex, endIndex) {
        return parts.slice(startIndex, endIndex).reduce(function (offset, part) { return offset + part.length; }, 0);
    };
    PlaceholdersBuffer.prototype.parse = function (text) {
        var placeholderRegExp = /\$(\d+)/g;
        var parts = [];
        var orders = [];
        var textOffset = 0;
        while (true) {
            var match = placeholderRegExp.exec(text);
            if (!match) {
                break;
            }
            var part = text.slice(textOffset, match.index);
            parts.push(part);
            // Accounts for placeholders at text boundaries
            if (part !== '') {
                parts.push('');
            }
            var order = parseInt(match[1], 10);
            orders.push({ index: parts.length - 1, order: order });
            textOffset += part.length + match.length;
        }
        // Ensures string serialization still works if no placeholders were parsed
        // and also accounts for the remainder of text with placeholders
        parts.push(text.slice(textOffset));
        return {
            // Placeholder values do not necessarily appear sequentially so sort the
            // indices to traverse in priority order
            orders: orders.sort(function (o1, o2) { return o1.order - o2.order; }).map(function (o) { return o.index; }),
            parts: parts,
        };
    };
    return PlaceholdersBuffer;
}());
export default PlaceholdersBuffer;
//# sourceMappingURL=PlaceholdersBuffer.js.map