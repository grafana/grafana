import { alignCurrentWithMulti } from './multiOptions';
describe('alignCurrentWithMulti', function () {
    describe('when current has string array values and multi is false', function () {
        it('should return current without string arrays', function () {
            var current = {
                value: ['A'],
                text: ['A'],
                selected: false,
            };
            var next = alignCurrentWithMulti(current, false);
            expect(next).toEqual({
                value: 'A',
                text: 'A',
                selected: false,
            });
        });
    });
    describe('when current has string values and multi is true', function () {
        it('should return current with string arrays', function () {
            var current = {
                value: 'A',
                text: 'A',
                selected: false,
            };
            var next = alignCurrentWithMulti(current, true);
            expect(next).toEqual({
                value: ['A'],
                text: ['A'],
                selected: false,
            });
        });
    });
    describe('when current has string values and multi is false', function () {
        it('should return current without string arrays', function () {
            var current = {
                value: 'A',
                text: 'A',
                selected: false,
            };
            var next = alignCurrentWithMulti(current, false);
            expect(next).toEqual({
                value: 'A',
                text: 'A',
                selected: false,
            });
        });
    });
    describe('when current has string array values and multi is true', function () {
        it('should return current with string arrays', function () {
            var current = {
                value: ['A'],
                text: ['A'],
                selected: false,
            };
            var next = alignCurrentWithMulti(current, true);
            expect(next).toEqual({
                value: ['A'],
                text: ['A'],
                selected: false,
            });
        });
    });
});
//# sourceMappingURL=multiOptions.test.js.map