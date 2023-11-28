import { formatDateWithYear, formatDateWithTime } from './UpdatePanel.utils';
describe('UpdatePanel utils', () => {
    const timestamp1 = '2020-06-08T19:16:57Z';
    const timestamp2 = '2020-06-08T03:06:57+03:00';
    const timestamp3 = '2020-06-08T03:06:57+03:30';
    const timestamp4 = '2021-04-06T00:00:00Z';
    it('should format an ISO 8601 timestamp correctly as date without time', () => {
        expect(formatDateWithYear(timestamp1)).toBe('June 08, 2020 UTC');
        expect(formatDateWithYear(timestamp2)).toBe('June 08, 2020 UTC');
        expect(formatDateWithYear(timestamp3)).toBe('June 07, 2020 UTC');
        expect(formatDateWithYear(timestamp4)).toBe('April 06, 2021 UTC');
    });
    it('should format an ISO 8601 timestamp correctly as date with time', () => {
        expect(formatDateWithTime(timestamp1)).toBe('June 08, 19:16 UTC');
        expect(formatDateWithTime(timestamp2)).toBe('June 08, 0:06 UTC');
        expect(formatDateWithTime(timestamp3)).toBe('June 07, 23:36 UTC');
        expect(formatDateWithTime(timestamp4)).toBe('April 06, 0:00 UTC');
    });
});
//# sourceMappingURL=UpdatePanel.utils.test.js.map