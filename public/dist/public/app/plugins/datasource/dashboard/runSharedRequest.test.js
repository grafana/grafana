import { isSharedDashboardQuery } from './runSharedRequest';
describe('SharedQueryRunner', function () {
    it('should identify shared queries', function () {
        expect(isSharedDashboardQuery('-- Dashboard --')).toBe(true);
        expect(isSharedDashboardQuery('')).toBe(false);
        expect(isSharedDashboardQuery(undefined)).toBe(false);
        expect(isSharedDashboardQuery(null)).toBe(false);
        var ds = {
            meta: {
                name: '-- Dashboard --',
            },
        };
        expect(isSharedDashboardQuery(ds)).toBe(true);
        ds.meta.name = 'something else';
        expect(isSharedDashboardQuery(ds)).toBe(false);
    });
});
//# sourceMappingURL=runSharedRequest.test.js.map