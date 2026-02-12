import { LogsSortOrder } from '@grafana/data';

import { onSortOrderChange } from './onSortOrderChange';
import { Options } from './types';

describe('onSortOrderChange', () => {
  const timeFieldName = 'timestamp';
  it('should update', () => {
    const options = { sortBy: [], sortOrder: LogsSortOrder.Ascending } as unknown as Options;
    expect(onSortOrderChange(options, LogsSortOrder.Descending, timeFieldName)).toEqual({
      sortBy: [{ desc: false, displayName: timeFieldName }],
      sortOrder: LogsSortOrder.Ascending,
    });
  });

  it('should handle undefined sortOrder', () => {
    const options = { sortBy: [], sortOrder: undefined } as unknown as Options;
    expect(onSortOrderChange(options, undefined, timeFieldName)).toEqual({
      sortBy: [],
    });
  });

  it('should not update', () => {
    const options = {
      sortBy: [{ desc: false, displayName: timeFieldName }],
      sortOrder: LogsSortOrder.Ascending,
    } as unknown as Options;

    expect(onSortOrderChange(options, LogsSortOrder.Descending, timeFieldName)).toEqual({
      sortBy: [{ desc: false, displayName: timeFieldName }],
      sortOrder: LogsSortOrder.Ascending,
    });
  });

  it('should create new sortBy array', () => {
    const options = {
      sortBy: [{ desc: false, displayName: timeFieldName }],
      sortOrder: LogsSortOrder.Ascending,
    } as unknown as Options;
    const result = onSortOrderChange(options, LogsSortOrder.Descending, timeFieldName);

    // Assert that sort is still ascending
    expect(result.sortBy).toEqual(options.sortBy);
    // Assert that return is new reference: if the array is the same reference, the useEffect will not re-render unless the length of the array has changed!
    expect(result.sortBy).not.toBe(options.sortBy);
  });
});
