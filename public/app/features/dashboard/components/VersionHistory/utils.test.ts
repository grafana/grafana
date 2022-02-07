import { Diff, getDiffOperationText, getDiffText, jsonDiff } from './utils';

describe('getDiffOperationText', () => {
  const cases = [
    ['add', 'added'],
    ['remove', 'deleted'],
    ['replace', 'changed'],
    ['byDefault', 'changed'],
  ];

  test.each(cases)('it returns the correct verb for an operation', (operation, expected) => {
    expect(getDiffOperationText(operation)).toBe(expected);
  });
});

type DiffTextCase = [Partial<Diff>, string];
describe('getDiffText', () => {
  const addEmptyArray: DiffTextCase = [
    { op: 'add', value: [], path: ['annotations', 'list'], startLineNumber: 24 },
    'added list',
  ];
  const addArrayNumericProp: DiffTextCase = [
    {
      op: 'add',
      value: ['tag'],
      path: ['panels', '3'],
    },
    'added item 3',
  ];
  const addArrayProp: DiffTextCase = [
    {
      op: 'add',
      value: [{ name: 'dummy target 1' }, { name: 'dummy target 2' }],
      path: ['panels', '3', 'targets'],
    },
    'added 2 targets',
  ];
  const addValueNumericProp: DiffTextCase = [
    {
      op: 'add',
      value: 'foo',
      path: ['panels', '3'],
    },
    'added item 3',
  ];
  const addValueProp: DiffTextCase = [
    {
      op: 'add',
      value: 'foo',
      path: ['panels', '3', 'targets'],
    },
    'added targets',
  ];

  const removeEmptyArray: DiffTextCase = [
    { op: 'remove', originalValue: [], path: ['annotations', 'list'], startLineNumber: 24 },
    'deleted list',
  ];
  const removeArrayNumericProp: DiffTextCase = [
    {
      op: 'remove',
      originalValue: ['tag'],
      path: ['panels', '3'],
    },
    'deleted item 3',
  ];
  const removeArrayProp: DiffTextCase = [
    {
      op: 'remove',
      originalValue: [{ name: 'dummy target 1' }, { name: 'dummy target 2' }],
      path: ['panels', '3', 'targets'],
    },
    'deleted 2 targets',
  ];
  const removeValueNumericProp: DiffTextCase = [
    {
      op: 'remove',
      originalValue: 'foo',
      path: ['panels', '3'],
    },
    'deleted item 3',
  ];
  const removeValueProp: DiffTextCase = [
    {
      op: 'remove',
      originalValue: 'foo',
      path: ['panels', '3', 'targets'],
    },
    'deleted targets',
  ];
  const replaceValueNumericProp: DiffTextCase = [
    {
      op: 'replace',
      originalValue: 'foo',
      value: 'bar',
      path: ['panels', '3'],
    },
    'changed item 3',
  ];
  const replaceValueProp: DiffTextCase = [
    {
      op: 'replace',
      originalValue: 'foo',
      value: 'bar',
      path: ['panels', '3', 'targets'],
    },
    'changed targets',
  ];

  const cases = [
    addEmptyArray,
    addArrayNumericProp,
    addArrayProp,
    addValueNumericProp,
    addValueProp,
    removeEmptyArray,
    removeArrayNumericProp,
    removeArrayProp,
    removeValueNumericProp,
    removeValueProp,
    replaceValueNumericProp,
    replaceValueProp,
  ];

  test.each(cases)(
    'returns a semantic message based on the type of diff, the values and the location of the change',
    (diff: Partial<Diff>, expected: string) => {
      expect(getDiffText(diff as unknown as Diff)).toBe(expected);
    }
  );
});

describe('jsonDiff', () => {
  it('returns data related to each change', () => {
    const lhs = {
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: '-- Grafana --',
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard',
          },
        ],
      },
      editable: true,
      gnetId: null,
      graphTooltip: 0,
      id: 141,
      links: [],
      panels: [],
      schemaVersion: 27,
      style: 'dark',
      tags: [],
      templating: {
        list: [],
      },
      time: {
        from: 'now-6h',
        to: 'now',
      },
      timepicker: {},
      timezone: '',
      title: 'test dashboard',
      uid: '_U4zObQMz',
      version: 2,
    };

    const rhs = {
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: '-- Grafana --',
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard',
          },
        ],
      },
      description: 'a description',
      editable: true,
      gnetId: null,
      graphTooltip: 1,
      id: 141,
      links: [],
      panels: [
        {
          type: 'graph',
        },
      ],
      schemaVersion: 27,
      style: 'dark',
      tags: ['the tag'],
      templating: {
        list: [],
      },
      time: {
        from: 'now-6h',
        to: 'now',
      },
      timepicker: {
        refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
      },
      timezone: 'utc',
      title: 'My favourite dashboard',
      uid: '_U4zObQMz',
      version: 3,
    };

    const expected = {
      description: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['description'],
          startLineNumber: 14,
          value: 'a description',
        },
      ],
      graphTooltip: [
        {
          op: 'replace',
          originalValue: 0,
          path: ['graphTooltip'],
          startLineNumber: 17,
          value: 1,
        },
      ],
      panels: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['panels', '0'],
          startLineNumber: 21,
          value: {
            type: 'graph',
          },
        },
      ],
      tags: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['tags', '0'],
          startLineNumber: 28,
          value: 'the tag',
        },
      ],
      timepicker: [
        {
          op: 'add',
          originalValue: undefined,
          path: ['timepicker', 'refresh_intervals'],
          startLineNumber: 38,
          value: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
        },
      ],
      timezone: [
        {
          op: 'replace',
          originalValue: '',
          path: ['timezone'],
          startLineNumber: 52,
          value: 'utc',
        },
      ],
      title: [
        {
          op: 'replace',
          originalValue: 'test dashboard',
          path: ['title'],
          startLineNumber: 53,
          value: 'My favourite dashboard',
        },
      ],
      version: [
        {
          op: 'replace',
          originalValue: 2,
          path: ['version'],
          startLineNumber: 55,
          value: 3,
        },
      ],
    };

    expect(jsonDiff(lhs, rhs)).toStrictEqual(expected);
  });
});
