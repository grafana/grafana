import { Diff } from 'app/features/dashboard/components/VersionHistory/utils';

import { DASHBOARD_SCHEMA_VERSION } from '../../state/DashboardMigrator';
import { createDashboardModelFixture, createPanelSaveModel } from '../../state/__fixtures__/dashboardFixtures';

import {
  orderProperties,
  JSONArray,
  JSONValue,
  isObject,
  getDashboardStringDiff,
  removeEmptyFields,
  reorganizeDiffs,
  separateRootAndNonRootDiffs,
} from './jsonDiffText';

describe('orderProperties', () => {
  it('should sort simple objects', () => {
    // Simplest possible case
    const before = {
      firstProperty: 'foo',
      secondProperty: 'bar',
    };

    const after = {
      secondProperty: 'bar',
      firstProperty: 'foo',
    };

    // Call the function to test
    const result = orderProperties(before, after);

    expect(result).toEqual({
      firstProperty: 'foo',
      secondProperty: 'bar',
    });
  });

  it('should sort arrays', () => {
    const result = orderProperties([0, 1], [1, 0]);

    expect(result).toEqual([0, 1]);
  });

  it('should handle nested objects', () => {
    const before = {
      nested: {
        firstProperty: 'foo',
        secondProperty: 'bar',
      },
    };

    const after = {
      nested: {
        secondProperty: 'bar',
        firstProperty: 'foo',
      },
    };

    const result = orderProperties(before, after);

    expect(result).toEqual({
      nested: {
        firstProperty: 'foo',
        secondProperty: 'bar',
      },
    });
  });

  it('should handle arrays of objects with different order', () => {
    const before = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const after = [
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice' },
    ];

    const result = orderProperties(before, after);

    expect(result).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  });

  it('should handle null values', () => {
    const before = {
      a: null,
      b: null,
    };

    const after = {
      b: null,
      a: null,
    };

    const result = orderProperties(before, after);

    expect(result).toEqual({
      a: null,
      b: null,
    });
  });

  it('should handle empty objects', () => {
    const before = {};
    const after = {};

    const result = orderProperties(before, after);

    expect(result).toEqual({});
  });

  it('should handle empty arrays', () => {
    const before: JSONValue[] = [];
    const after: JSONValue[] = [];

    const result = orderProperties(before, after);

    expect(result).toEqual([]);
  });

  it('should handle deeply nested objects', () => {
    const before = {
      a: {
        b: {
          c: 'foo',
        },
      },
      d: 'bar',
    };

    const after = {
      d: 'bar',
      a: {
        b: {
          c: 'foo',
        },
      },
    };

    const result = orderProperties(before, after);

    expect(result).toEqual({
      a: {
        b: {
          c: 'foo',
        },
      },
      d: 'bar',
    });
  });

  it('should handle arrays of nested objects', () => {
    const before = [
      { id: 1, nested: { name: 'Alice' } },
      { id: 2, nested: { name: 'Bob' } },
    ];

    const after = [
      { id: 2, nested: { name: 'Bob' } },
      { id: 1, nested: { name: 'Alice' } },
    ];

    const result = orderProperties(before, after);

    expect(result).toEqual([
      { id: 1, nested: { name: 'Alice' } },
      { id: 2, nested: { name: 'Bob' } },
    ]);
  });

  it('should handle mixed arrays of objects and primitive values', () => {
    const before = [{ id: 1 }, 42, [3, 2, 1]];

    const after = [{ id: 1 }, [3, 2, 1], 42];

    const result = orderProperties(before, after);

    expect(result).toEqual([{ id: 1 }, 42, [3, 2, 1]]);
  });

  it('should handle arrays of objects with nested arrays', () => {
    const before = [
      { id: 1, values: [3, 2, 1] },
      { id: 2, values: [6, 5, 4] },
    ];

    const after = [
      { id: 2, values: [6, 5, 4] },
      { id: 1, values: [3, 2, 1] },
    ];

    const result = orderProperties(before, after);

    expect(result).toEqual([
      { id: 1, values: [3, 2, 1] },
      { id: 2, values: [6, 5, 4] },
    ]);
  });

  it('should handle arrays of arrays', () => {
    const before = [
      [1, 2, 3],
      [4, 5, 6],
    ];

    const after = [
      [4, 5, 6],
      [1, 2, 3],
    ];

    const result = orderProperties(before, after);

    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('should match reordered and modified arrays to nearest keys', () => {
    const before = [
      { id: '1', name: 'Alice', country: 'England' },
      { id: '2', name: 'Bob', country: 'America' },
      { id: '3', name: 'Charlie', country: 'Foxtrot' },
    ];

    const after: JSONArray = [{ name: 'Charlie', country: 'Foxtrot' }, { name: 'Alice' }];

    const result = orderProperties(before, after);

    expect(result).toEqual([{ name: 'Alice' }, { name: 'Charlie', country: 'Foxtrot' }]);
  });
});

describe('isObject', () => {
  it('should return true for non-array objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ foo: 'bar' })).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('')).toBe(false);
    expect(isObject(123)).toBe(false);
    expect(isObject(true)).toBe(false);
  });
});

describe('getDashboardStringDiff', () => {
  const dashboard = {
    title: 'Original Title',
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    panels: [
      createPanelSaveModel({
        id: 1,
        title: 'Original Panel Title',
        gridPos: { x: 0, y: 0, w: 2, h: 2 },
      }),
      createPanelSaveModel({
        id: 2,
        title: 'Panel to be moved',
        gridPos: { x: 2, y: 0, w: 2, h: 2 },
      }),
    ],
  };

  it('should no return changes when nothing changes', () => {
    const dashboardModel = createDashboardModelFixture(dashboard);

    const result = getDashboardStringDiff(dashboardModel);

    expect(result).toEqual({
      migrationDiff: '',
      userDiff: '',
    });
  });

  it('should return a diff of the dashboard title as user change', () => {
    const dashboardModel = createDashboardModelFixture(dashboard);
    dashboardModel.title = 'New Title';

    const result = getDashboardStringDiff(dashboardModel);

    expect(result.userDiff).toContain(`-  \"title\": \"Original Title\"`);
    expect(result.userDiff).toContain(`+  \"title\": \"New Title\",`);
  });

  it('should return a diff when a panel is moved', () => {
    const dashboardModel = createDashboardModelFixture(dashboard);

    // Move the panel with id 2 to a new position
    dashboardModel.panels[1].gridPos = { x: 1, y: 1, w: 2, h: 2 };

    const result = getDashboardStringDiff(dashboardModel);

    const panelToBeMovedDiff: string = [
      '- "type": "timeseries",',
      '- "gridPos": {',
      '-   "x": 2,',
      '-   "y": 0,',
      '-   "w": 2,',
      '-   "h": 2',
      '- },',
      '+ "gridPos": {',
      '+   "h": 2,',
      '+   "w": 2,',
      '+   "x": 1,',
      '+   "y": 1',
      '+ },',
      '+ "type": "timeseries"',
    ].join('\n');

    // Replace newlines in the string with the actual newline character
    const panelToBeMovedDiffForComparison = panelToBeMovedDiff.replace(/\\n/g, '\n');

    // Check that the userDiff contains information about the panel move
    expect(result.userDiff).toContain(panelToBeMovedDiffForComparison);
  });
});

describe('removeEmptyFields', () => {
  it('should remove "null" fields from the JSON object', () => {
    const inputJSON = {
      a: null,
      b: 'Hello',
      c: {
        d: null,
        e: 'World',
      },
    };

    const result = removeEmptyFields(inputJSON);

    expect(result).toEqual({
      b: 'Hello',
      c: {
        e: 'World',
      },
    });
  });

  it('should remove empty arrays from the JSON object', () => {
    const inputJSON = {
      a: [1, 2, 3],
      b: [],
      c: [4, 5],
    };

    const result = removeEmptyFields(inputJSON);

    expect(result).toEqual({
      a: [1, 2, 3],
      c: [4, 5],
    });
  });

  it('should remove empty objects from the JSON object', () => {
    const inputJSON = {
      a: {},
      b: 'Hello',
      c: {
        d: {},
        e: 'World',
      },
    };

    const result = removeEmptyFields(inputJSON);

    expect(result).toEqual({
      b: 'Hello',
      c: {
        e: 'World',
      },
    });
  });

  it('should handle a mix of "null", empty arrays, and empty objects', () => {
    const inputJSON = {
      a: null,
      b: [],
      c: {
        d: null,
        e: {},
        f: [1, 2, 3],
        g: 'Hello',
      },
    };

    const result = removeEmptyFields(inputJSON);

    expect(result).toEqual({
      c: {
        f: [1, 2, 3],
        g: 'Hello',
      },
    });
  });

  it('should handle nested structures', () => {
    const inputJSON = {
      a: {
        b: {
          c: null,
          d: {
            e: [],
            f: 'World',
          },
        },
      },
    };

    const result = removeEmptyFields(inputJSON);

    expect(result).toEqual({
      a: {
        b: {
          d: {
            f: 'World',
          },
        },
      },
    });
  });

  it('should handle complex JSON structure', () => {
    const inputJSON = {
      panels: [
        {
          fieldConfig: {
            defaults: {
              foo: 'bar',
            },
            overrides: [],
          },
          gridPos: {
            h: 15,
            w: 10,
            x: 0,
            y: 0,
          },
        },
      ],
      schemaVersion: 38,
    };

    const result = removeEmptyFields(inputJSON);

    expect(result).toEqual({
      panels: [
        {
          fieldConfig: {
            defaults: {
              foo: 'bar',
            },
          },
          gridPos: {
            h: 15,
            w: 10,
            x: 0,
            y: 0,
          },
        },
      ],
      schemaVersion: 38,
    });
  });
});

describe('reorganizeDiffs', () => {
  it('reorganizes diffs with path of length 1', () => {
    const diffRecord: Record<string, Diff[]> = {
      tags: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['tags'],
          startLineNumber: 27,
          value: 'the tag',
        },
      ],
      timepicker: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['timepicker'],
          startLineNumber: 37,
          value: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
        },
      ],
    };

    const reorganizedDiffs = reorganizeDiffs(diffRecord);

    expect(reorganizedDiffs).toEqual({
      tags: [diffRecord.tags[0]],
      timepicker: [diffRecord.timepicker[0]],
    });
  });

  it('reorganizes diffs with path of length greater than 1', () => {
    const diffRecord: Record<string, Diff[]> = {
      dashboard: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['dashboard', 'annotations', 'list', '0'],
          startLineNumber: 27,
          value: 'the tag',
        },
        {
          op: 'add',
          originalValue: undefined,
          path: ['dashboard', 'timepicker', 'refresh_intervals'],
          startLineNumber: 37,
          value: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
        },
      ],
    };

    const reorganizedDiffs = reorganizeDiffs(diffRecord);

    expect(reorganizedDiffs).toEqual({
      'dashboard/annotations/list': [diffRecord['dashboard'][0]],
      'dashboard/timepicker': [diffRecord['dashboard'][1]],
    });
  });

  it('reorganizes an empty object of diffs', () => {
    const reorganizedDiffs = reorganizeDiffs({});
    expect(reorganizedDiffs).toEqual({});
  });
});

describe('separateRootAndNonRootDiffs', () => {
  it('separates root and non-root diffs', () => {
    const diffRecord: Record<string, Diff[]> = {
      tags: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['tags'],
          startLineNumber: 27,
          value: 'the tag',
        },
      ],
      dashboard: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['dashboard', 'annotations', 'list', '0'],
          startLineNumber: 27,
          value: 'the tag',
        },
        {
          op: 'add',
          originalValue: undefined,
          path: ['dashboard', 'timepicker', 'refresh_intervals'],
          startLineNumber: 37,
          value: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
        },
      ],
    };

    const { rootDiffs, nonRootDiffs } = separateRootAndNonRootDiffs(diffRecord);

    expect(rootDiffs).toEqual({
      tags: [diffRecord.tags[0]],
    });

    expect(nonRootDiffs).toEqual({
      'dashboard/annotations/list': [diffRecord.dashboard[0]],
      'dashboard/timepicker': [diffRecord.dashboard[1]],
    });
  });
});
