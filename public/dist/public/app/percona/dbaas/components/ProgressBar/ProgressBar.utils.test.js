import { getProgressBarPercentage } from './ProgressBar.utils';
describe('ProgressBar.utils::', () => {
    it('returns 0 when total steps is 0', () => {
        expect(getProgressBarPercentage(10, 0)).toEqual(0);
    });
    it('returns 100 when finished steps are greater than total steps', () => {
        expect(getProgressBarPercentage(6, 2)).toEqual(100);
    });
    it('returns correct percentage', () => {
        expect(getProgressBarPercentage(10, 100)).toEqual(10);
    });
    it('returns correct percentage rounded', () => {
        expect(getProgressBarPercentage(1, 7)).toEqual(14);
    });
});
//# sourceMappingURL=ProgressBar.utils.test.js.map