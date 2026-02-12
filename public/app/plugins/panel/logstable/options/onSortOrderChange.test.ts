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
    const options = { sortBy: [{ desc: false, displayName: timeFieldName }] } as unknown as Options;
    expect(onSortOrderChange(options, LogsSortOrder.Descending, timeFieldName)).toEqual({
      sortBy: [{ desc: false, displayName: timeFieldName }],
    });

    expect(onSortOrderChange(options, LogsSortOrder.Descending, timeFieldName)).not.toBe({
      sortBy: [{ desc: false, displayName: timeFieldName }],
    });
  });
});
