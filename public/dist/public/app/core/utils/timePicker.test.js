import { toUtc } from '@grafana/data';
import { getShiftedTimeRange, getZoomedTimeRange } from './timePicker';
export const setup = (options) => {
    const defaultOptions = {
        range: {
            from: toUtc('2019-01-01 10:00:00'),
            to: toUtc('2019-01-01 16:00:00'),
            raw: {
                from: 'now-6h',
                to: 'now',
            },
        },
        direction: 0,
    };
    return Object.assign(Object.assign({}, defaultOptions), options);
};
describe('getShiftedTimeRange', () => {
    describe('when called with a direction of -1', () => {
        it('then it should return correct result', () => {
            const { range, direction } = setup({ direction: -1 });
            const expectedRange = {
                from: toUtc('2019-01-01 07:00:00').valueOf(),
                to: toUtc('2019-01-01 13:00:00').valueOf(),
            };
            const result = getShiftedTimeRange(direction, range);
            expect(result).toEqual(expectedRange);
        });
    });
    describe('when called with a direction of 1', () => {
        it('then it should return correct result', () => {
            const { range, direction } = setup({ direction: 1 });
            const expectedRange = {
                from: toUtc('2019-01-01 13:00:00').valueOf(),
                to: toUtc('2019-01-01 19:00:00').valueOf(),
            };
            const result = getShiftedTimeRange(direction, range);
            expect(result).toEqual(expectedRange);
        });
    });
    describe('when called with any other direction', () => {
        it('then it should return correct result', () => {
            const { range, direction } = setup({ direction: 0 });
            const expectedRange = {
                from: toUtc('2019-01-01 10:00:00').valueOf(),
                to: toUtc('2019-01-01 16:00:00').valueOf(),
            };
            const result = getShiftedTimeRange(direction, range);
            expect(result).toEqual(expectedRange);
        });
    });
});
describe('getZoomedTimeRange', () => {
    describe('when called', () => {
        it('then it should return correct result', () => {
            const { range } = setup();
            const expectedRange = {
                from: toUtc('2019-01-01 07:00:00').valueOf(),
                to: toUtc('2019-01-01 19:00:00').valueOf(),
            };
            const result = getZoomedTimeRange(range, 2);
            expect(result).toEqual(expectedRange);
        });
    });
    describe('when called with a timespan of 0', () => {
        it('then it should return a timespan of 30s', () => {
            const range = {
                from: toUtc('2019-01-01 10:00:00'),
                to: toUtc('2019-01-01 10:00:00'),
                raw: {
                    from: 'now',
                    to: 'now',
                },
            };
            const expectedRange = {
                from: toUtc('2019-01-01 09:59:45').valueOf(),
                to: toUtc('2019-01-01 10:00:15').valueOf(),
            };
            const result = getZoomedTimeRange(range, 2);
            expect(result).toEqual(expectedRange);
        });
    });
});
//# sourceMappingURL=timePicker.test.js.map