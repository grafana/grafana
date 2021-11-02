import { dedupAnnotations } from '../events_processing';
describe('Annotations deduplication', function () {
    it('should remove duplicated annotations', function () {
        var testAnnotations = [
            { id: 1, time: 1 },
            { id: 2, time: 2 },
            { id: 2, time: 2 },
            { id: 5, time: 5 },
            { id: 5, time: 5 },
        ];
        var expectedAnnotations = [
            { id: 1, time: 1 },
            { id: 2, time: 2 },
            { id: 5, time: 5 },
        ];
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
        var expectedAnnotations = [
            { id: 1, time: 1 },
            { id: 2, time: 2 },
            { id: 5, time: 5 },
        ];
        var deduplicated = dedupAnnotations(testAnnotations);
        expect(deduplicated).toEqual(expectedAnnotations);
    });
});
//# sourceMappingURL=annotations_srv_specs.test.js.map