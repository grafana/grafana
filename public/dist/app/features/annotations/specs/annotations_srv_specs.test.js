import { makeRegions, dedupAnnotations } from '../events_processing';
describe('Annotations', function () {
    describe('Annotations regions', function () {
        var testAnnotations;
        beforeEach(function () {
            testAnnotations = [
                { id: 1, time: 1 },
                { id: 2, time: 2 },
                { id: 3, time: 3, regionId: 3 },
                { id: 4, time: 5, regionId: 3 },
                { id: 5, time: 4, regionId: 5 },
                { id: 6, time: 8, regionId: 5 },
            ];
        });
        it('should convert single region events to regions', function () {
            var range = { from: 0, to: 10 };
            var expectedAnnotations = [
                { id: 3, regionId: 3, isRegion: true, time: 3, timeEnd: 5 },
                { id: 5, regionId: 5, isRegion: true, time: 4, timeEnd: 8 },
                { id: 1, time: 1 },
                { id: 2, time: 2 },
            ];
            var regions = makeRegions(testAnnotations, { range: range });
            expect(regions).toEqual(expectedAnnotations);
        });
        it('should cut regions to current time range', function () {
            var range = { from: 0, to: 8 };
            testAnnotations = [{ id: 5, time: 4, regionId: 5 }];
            var expectedAnnotations = [{ id: 5, regionId: 5, isRegion: true, time: 4, timeEnd: 7 }];
            var regions = makeRegions(testAnnotations, { range: range });
            expect(regions).toEqual(expectedAnnotations);
        });
    });
    describe('Annotations deduplication', function () {
        it('should remove duplicated annotations', function () {
            var testAnnotations = [
                { id: 1, time: 1 },
                { id: 2, time: 2 },
                { id: 2, time: 2 },
                { id: 5, time: 5 },
                { id: 5, time: 5 },
            ];
            var expectedAnnotations = [{ id: 1, time: 1 }, { id: 2, time: 2 }, { id: 5, time: 5 }];
            var deduplicated = dedupAnnotations(testAnnotations);
            expect(deduplicated).toEqual(expectedAnnotations);
        });
        it('should leave non "panel-alert" event if present', function () {
            var testAnnotations = [
                { id: 1, time: 1 },
                { id: 2, time: 2 },
                { id: 2, time: 2, eventType: 'panel-alert' },
                { id: 5, time: 5 },
                { id: 5, time: 5 },
            ];
            var expectedAnnotations = [{ id: 1, time: 1 }, { id: 2, time: 2 }, { id: 5, time: 5 }];
            var deduplicated = dedupAnnotations(testAnnotations);
            expect(deduplicated).toEqual(expectedAnnotations);
        });
    });
});
//# sourceMappingURL=annotations_srv_specs.test.js.map