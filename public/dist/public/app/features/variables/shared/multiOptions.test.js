import { alignCurrentWithMulti } from './multiOptions';
describe('alignCurrentWithMulti', () => {
    describe('when current has string array values and multi is false', () => {
        it('should return current without string arrays', () => {
            const current = {
                value: ['A'],
                text: ['A'],
                selected: false,
            };
            const next = alignCurrentWithMulti(current, false);
            expect(next).toEqual({
                value: 'A',
                text: 'A',
                selected: false,
            });
        });
    });
    describe('when current has string values and multi is true', () => {
        it('should return current with string arrays', () => {
            const current = {
                value: 'A',
                text: 'A',
                selected: false,
            };
            const next = alignCurrentWithMulti(current, true);
            expect(next).toEqual({
                value: ['A'],
                text: ['A'],
                selected: false,
            });
        });
    });
    describe('when current has string values and multi is false', () => {
        it('should return current without string arrays', () => {
            const current = {
                value: 'A',
                text: 'A',
                selected: false,
            };
            const next = alignCurrentWithMulti(current, false);
            expect(next).toEqual({
                value: 'A',
                text: 'A',
                selected: false,
            });
        });
    });
    describe('when current has string array values and multi is true', () => {
        it('should return current with string arrays', () => {
            const current = {
                value: ['A'],
                text: ['A'],
                selected: false,
            };
            const next = alignCurrentWithMulti(current, true);
            expect(next).toEqual({
                value: ['A'],
                text: ['A'],
                selected: false,
            });
        });
    });
});
//# sourceMappingURL=multiOptions.test.js.map