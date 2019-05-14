import PlaceholdersBuffer from './PlaceholdersBuffer';
describe('PlaceholdersBuffer', function () {
    it('does nothing if no placeholders are defined', function () {
        var text = 'metric';
        var buffer = new PlaceholdersBuffer(text);
        expect(buffer.hasPlaceholders()).toBe(false);
        expect(buffer.toString()).toBe(text);
        expect(buffer.getNextMoveOffset()).toBe(0);
    });
    it('respects the traversal order of placeholders', function () {
        var text = 'sum($2 offset $1) by ($3)';
        var buffer = new PlaceholdersBuffer(text);
        expect(buffer.hasPlaceholders()).toBe(true);
        expect(buffer.toString()).toBe('sum( offset ) by ()');
        expect(buffer.getNextMoveOffset()).toBe(12);
        buffer.setNextPlaceholderValue('1h');
        expect(buffer.hasPlaceholders()).toBe(true);
        expect(buffer.toString()).toBe('sum( offset 1h) by ()');
        expect(buffer.getNextMoveOffset()).toBe(-10);
        buffer.setNextPlaceholderValue('metric');
        expect(buffer.hasPlaceholders()).toBe(true);
        expect(buffer.toString()).toBe('sum(metric offset 1h) by ()');
        expect(buffer.getNextMoveOffset()).toBe(16);
        buffer.setNextPlaceholderValue('label');
        expect(buffer.hasPlaceholders()).toBe(false);
        expect(buffer.toString()).toBe('sum(metric offset 1h) by (label)');
        expect(buffer.getNextMoveOffset()).toBe(0);
    });
    it('respects the traversal order of adjacent placeholders', function () {
        var text = '$1$3$2$4';
        var buffer = new PlaceholdersBuffer(text);
        expect(buffer.hasPlaceholders()).toBe(true);
        expect(buffer.toString()).toBe('');
        expect(buffer.getNextMoveOffset()).toBe(0);
        buffer.setNextPlaceholderValue('1');
        expect(buffer.hasPlaceholders()).toBe(true);
        expect(buffer.toString()).toBe('1');
        expect(buffer.getNextMoveOffset()).toBe(0);
        buffer.setNextPlaceholderValue('2');
        expect(buffer.hasPlaceholders()).toBe(true);
        expect(buffer.toString()).toBe('12');
        expect(buffer.getNextMoveOffset()).toBe(-1);
        buffer.setNextPlaceholderValue('3');
        expect(buffer.hasPlaceholders()).toBe(true);
        expect(buffer.toString()).toBe('132');
        expect(buffer.getNextMoveOffset()).toBe(1);
        buffer.setNextPlaceholderValue('4');
        expect(buffer.hasPlaceholders()).toBe(false);
        expect(buffer.toString()).toBe('1324');
        expect(buffer.getNextMoveOffset()).toBe(0);
    });
});
//# sourceMappingURL=PlaceholdersBuffer.test.js.map