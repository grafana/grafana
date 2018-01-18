import { makeRegions, dedupAnnotations } from '../events_processing';

describe('Annotations', () => {
  describe('Annotations regions', () => {
    let testAnnotations: any[];

    beforeEach(() => {
      testAnnotations = [
        { id: 1, time: 1 },
        { id: 2, time: 2 },
        { id: 3, time: 3, regionId: 3 },
        { id: 4, time: 5, regionId: 3 },
        { id: 5, time: 4, regionId: 5 },
        { id: 6, time: 8, regionId: 5 },
      ];
    });

    it('should convert single region events to regions', () => {
      const range = { from: 0, to: 10 };
      const expectedAnnotations = [
        { id: 3, regionId: 3, isRegion: true, time: 3, timeEnd: 5 },
        { id: 5, regionId: 5, isRegion: true, time: 4, timeEnd: 8 },
        { id: 1, time: 1 },
        { id: 2, time: 2 },
      ];

      let regions = makeRegions(testAnnotations, { range: range });
      expect(regions).toEqual(expectedAnnotations);
    });

    it('should cut regions to current time range', () => {
      const range = { from: 0, to: 8 };
      testAnnotations = [{ id: 5, time: 4, regionId: 5 }];
      const expectedAnnotations = [{ id: 5, regionId: 5, isRegion: true, time: 4, timeEnd: 7 }];

      let regions = makeRegions(testAnnotations, { range: range });
      expect(regions).toEqual(expectedAnnotations);
    });
  });

  describe('Annotations deduplication', () => {
    it('should remove duplicated annotations', () => {
      const testAnnotations = [
        { id: 1, time: 1 },
        { id: 2, time: 2 },
        { id: 2, time: 2 },
        { id: 5, time: 5 },
        { id: 5, time: 5 },
      ];
      const expectedAnnotations = [{ id: 1, time: 1 }, { id: 2, time: 2 }, { id: 5, time: 5 }];

      let deduplicated = dedupAnnotations(testAnnotations);
      expect(deduplicated).toEqual(expectedAnnotations);
    });

    it('should leave non "panel-alert" event if present', () => {
      const testAnnotations = [
        { id: 1, time: 1 },
        { id: 2, time: 2 },
        { id: 2, time: 2, eventType: 'panel-alert' },
        { id: 5, time: 5 },
        { id: 5, time: 5 },
      ];
      const expectedAnnotations = [{ id: 1, time: 1 }, { id: 2, time: 2 }, { id: 5, time: 5 }];

      let deduplicated = dedupAnnotations(testAnnotations);
      expect(deduplicated).toEqual(expectedAnnotations);
    });
  });
});
