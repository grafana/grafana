import { dedupAnnotations } from '../events_processing';

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

    const deduplicated = dedupAnnotations(testAnnotations);
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

    const deduplicated = dedupAnnotations(testAnnotations);
    expect(deduplicated).toEqual(expectedAnnotations);
  });
});
