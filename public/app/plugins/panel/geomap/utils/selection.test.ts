import type { SelectableValue } from '@grafana/data/types';

import { getSelectionInfo } from './selection';

describe('getSelectionInfo', () => {
  it.each([
    {
      name: 'synthesizes a single option when a value is set but no option list is passed',
      value: 'coords' as string | undefined,
      options: undefined as Array<SelectableValue<string>> | undefined,
      expectedOptions: [{ label: 'coords', value: 'coords' }],
      expectedCurrent: { label: 'coords', value: 'coords' },
    },
    {
      name: 'returns empty options when no value and no options',
      value: undefined,
      options: undefined,
      expectedOptions: [],
      expectedCurrent: undefined,
    },
    {
      name: 'selects the matching option when the value exists in the list',
      value: 'b',
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
      expectedOptions: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
      expectedCurrent: { label: 'B', value: 'b' },
    },
    {
      name: 'appends a synthetic option when the value is missing from the list',
      value: 'legacy',
      options: [{ label: 'A', value: 'a' }],
      expectedOptions: [
        { label: 'A', value: 'a' },
        { label: 'legacy (not found)', value: 'legacy' },
      ],
      expectedCurrent: { label: 'legacy (not found)', value: 'legacy' },
    },
  ])('$name', ({ value, options, expectedOptions, expectedCurrent }) => {
    const { options: outOptions, current } = getSelectionInfo(value, options);
    expect(outOptions).toEqual(expectedOptions);
    expect(current).toEqual(expectedCurrent);
  });
});
