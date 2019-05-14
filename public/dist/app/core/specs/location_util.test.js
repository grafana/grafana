import locationUtil from 'app/core/utils/location_util';
jest.mock('app/core/config', function () {
    return {
        appSubUrl: '/subUrl',
    };
});
describe('locationUtil', function () {
    describe('With /subUrl as appSubUrl', function () {
        it('/subUrl should be stripped', function () {
            var urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/grafana/');
            expect(urlWithoutMaster).toBe('/grafana/');
        });
    });
});
//# sourceMappingURL=location_util.test.js.map