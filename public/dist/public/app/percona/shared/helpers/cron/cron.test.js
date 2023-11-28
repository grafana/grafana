import { getCronStringFromValues, parseCronString, getPeriodFromCronparts } from './cron';
describe('cron', () => {
    describe('getCronStringFromValues', () => {
        it('should generate wildcards if only period passed', () => {
            expect(getCronStringFromValues('year', [], [], [], [], [])).toBe('* * * * *');
            expect(getCronStringFromValues('month', [], [], [], [], [])).toBe('* * * * *');
            expect(getCronStringFromValues('week', [], [], [], [], [])).toBe('* * * * *');
            expect(getCronStringFromValues('day', [], [], [], [], [])).toBe('* * * * *');
            expect(getCronStringFromValues('hour', [], [], [], [], [])).toBe('* * * * *');
        });
        describe('year period', () => {
            it('should generate correct expressions', () => {
                expect(getCronStringFromValues('year', [1, 2, 3], [10, 23], [0, 2], [], [])).toBe('* * 10,23 1-3 0,2');
                expect(getCronStringFromValues('year', [1, 2, 3], [10, 23], [0, 2], [10], [15, 30])).toBe('15,30 10 10,23 1-3 0,2');
                expect(getCronStringFromValues('year', [1, 2, 3], [10, 23], [0, 1, 2, 3, 4, 5, 6], [], [])).toBe('* * 10,23 1-3 *');
            });
        });
        describe('month period', () => {
            it('should generate correct expressions', () => {
                expect(getCronStringFromValues('month', [], [1, 3, 5], [], [], [])).toBe('* * 1-5/2 * *');
                expect(getCronStringFromValues('month', [], [], [], [], [0, 5, 6, 7])).toBe('0,5-7 * * * *');
            });
        });
        describe('week period', () => {
            it('should generate correct expressions', () => {
                expect(getCronStringFromValues('week', [], [], [1, 2, 3, 6], [], [25, 50])).toBe('25,50 * * * 1-3,6');
                expect(getCronStringFromValues('week', [], [], [], [], [25])).toBe('25 * * * *');
            });
        });
    });
    describe('parseCronString', () => {
        it('should correctly convert', () => {
            expect(parseCronString('* * * * *')).toEqual([[], [], [], [], []]);
            expect(parseCronString('* * 10,23 1-3 0,2')).toEqual([[], [], [10, 23], [1, 2, 3], [0, 2]]);
            expect(parseCronString('15,30 10 10,23 1-3 0,2')).toEqual([[15, 30], [10], [10, 23], [1, 2, 3], [0, 2]]);
            expect(parseCronString('* * 10,23 1-3 *')).toEqual([[], [], [10, 23], [1, 2, 3], []]);
            expect(parseCronString('* * 1-5/2 * *')).toEqual([[], [], [1, 3, 5], [], []]);
            expect(parseCronString('0,5-7 * * * *')).toEqual([[0, 5, 6, 7], [], [], [], []]);
            expect(parseCronString('25,50 * * * 1-3,6')).toEqual([[25, 50], [], [], [], [1, 2, 3, 6]]);
            expect(parseCronString('25 * * * *')).toEqual([[25], [], [], [], []]);
        });
    });
    describe('getPeriodFromCronparts', () => {
        it('should return the correct period', () => {
            expect(getPeriodFromCronparts([[10], [5, 10], [], [1, 10], []])).toBe('year');
            expect(getPeriodFromCronparts([[10], [5, 10], [5, 25, 30], [], []])).toBe('month');
            expect(getPeriodFromCronparts([[10], [5, 10], [], [], [0, 4]])).toBe('week');
            expect(getPeriodFromCronparts([[0], [5, 10, 23], [], [], []])).toBe('day');
            expect(getPeriodFromCronparts([[], [], [], [], []])).toBe('minute');
        });
    });
});
//# sourceMappingURL=cron.test.js.map