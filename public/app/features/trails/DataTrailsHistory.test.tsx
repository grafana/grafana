import { SceneObjectUrlValues } from '@grafana/scenes';

import { parseFilterTooltip, parseTimeTooltip } from './DataTrailsHistory';

type ParseTimeTestCase = {
  name: string;
  input: SceneObjectUrlValues;
  expected: string;
};

type ParseFilterTestCase = {
  name: string;
  input: { urlValues: SceneObjectUrlValues; filtersApplied: string[] };
  expected: string;
  expectedFiltersApplied: string[];
};

describe('DataTrailsHistory', () => {
  describe('parseTimeTooltip', () => {
    // global timezone is set to Pacific/Easter, see jest-config.js file
    test.each<ParseTimeTestCase>([
      {
        name: 'from history',
        input: { from: '2024-07-22T18:30:00.000Z', to: '2024-07-22T19:30:00.000Z', timeZone: 'PDT' },
        expected: '2024-07-22 18:30:00 - 2024-07-22 19:30:00',
      },
      {
        name: 'time change event with timezone',
        input: { from: '2024-07-22T18:30:00.000Z', to: '2024-07-22T19:30:00.000Z', timeZone: 'CET' },
        expected: '2024-07-22 20:30:00 - 2024-07-22 21:30:00',
      },
    ])('$name', ({ input, expected }) => {
      const result = parseTimeTooltip(input);
      expect(result).toBe(expected);
    });
  });

  describe('parseFilterTooltip', () => {
    test.each<ParseFilterTestCase>([
      {
        name: 'from history initial load',
        input: {
          urlValues: { 'var-filters': ['job|=|grafana'] },
          filtersApplied: [],
        },
        expected: 'job = grafana',
        expectedFiltersApplied: ['job|=|grafana'],
      },
      {
        name: 'from history initial load',
        input: {
          urlValues: { 'var-filters': ['job|=|grafana', 'instance|=|host.docker.internal:3000'] },
          filtersApplied: ['job|=|grafana'],
        },
        expected: 'instance = host.docker.internal:3000',
        expectedFiltersApplied: ['job|=|grafana', 'instance|=|host.docker.internal:3000'],
      },
    ])('$name', ({ input, expected, expectedFiltersApplied }) => {
      const filtersApplied = input.filtersApplied;
      const result = parseFilterTooltip(input.urlValues, filtersApplied);
      expect(result).toBe(expected);
      expect(filtersApplied).toEqual(expectedFiltersApplied);
    });
  });
});
