import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';

import { FieldType, toDataFrame } from '@grafana/data';

import { GroupByTransformerEditorBase } from './editors/GroupByTransformerEditor';
import {
  DataFieldsErrorWrapper,
  detectMixedQueryResults,
  getAllFieldNamesFromDataFrames,
  numberOrVariableValidator,
  TIMEOUT,
} from './utils';

describe('validator', () => {
  it('validates a positive number', () => {
    expect(numberOrVariableValidator(1)).toBe(true);
  });

  it('validates a negative number', () => {
    expect(numberOrVariableValidator(-1)).toBe(true);
  });

  it('validates zero', () => {
    expect(numberOrVariableValidator(0)).toBe(true);
  });

  it('validates a float', () => {
    expect(numberOrVariableValidator(1.2)).toBe(true);
  });

  it('validates a negative float', () => {
    expect(numberOrVariableValidator(1.2)).toBe(true);
  });

  it('validates a string that is a positive integer', () => {
    expect(numberOrVariableValidator('1')).toBe(true);
  });

  it('validates a string that is a negative integer', () => {
    expect(numberOrVariableValidator('-1')).toBe(true);
  });

  it('validates a string that is zero', () => {
    expect(numberOrVariableValidator('0')).toBe(true);
  });

  it('validates a string that is a float', () => {
    expect(numberOrVariableValidator('1.2')).toBe(true);
  });

  it('validates a string that is a negative float', () => {
    expect(numberOrVariableValidator('-1.2')).toBe(true);
  });

  it('fails a string that is not a number', () => {
    expect(numberOrVariableValidator('foo')).toBe(false);
  });

  it('validates a string that has a variable', () => {
    expect(numberOrVariableValidator('$foo')).toBe(true);
  });

  it('validates a string that has multiple variables', () => {
    expect(numberOrVariableValidator('$foo$asd')).toBe(true);
  });
});

describe('useAllFieldNamesFromDataFrames', () => {
  it('gets base and full field names', () => {
    let frames = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'T', type: FieldType.time, values: [1, 2, 3] },
          { name: 'N', type: FieldType.number, values: [100, 200, 300] },
          { name: 'S', type: FieldType.string, values: ['1', '2', '3'] },
        ],
      }),
      toDataFrame({
        refId: 'B',
        fields: [
          { name: 'T', type: FieldType.time, values: [1, 2, 3] },
          { name: 'N', type: FieldType.number, values: [100, 200, 300] },
          { name: 'S', type: FieldType.string, values: ['1', '2', '3'] },
        ],
      }),
    ].map((frame) => ({
      ...frame,
      fields: frame.fields.map((field) => ({
        ...field,
        state: {
          multipleFrames: true,
          displayName: `${field.name} (${frame.refId})`,
        },
      })),
    }));

    const names = getAllFieldNamesFromDataFrames(frames, true);

    expect(names).toEqual(['T', 'N', 'S', 'T (A)', 'N (A)', 'S (A)', 'T (B)', 'N (B)', 'S (B)']);
  });

  it('omit base names when field.name is unique', () => {
    let frames = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'T', config: { displayName: 't' }, type: FieldType.time, values: [1, 2, 3] },
          { name: 'N', config: { displayName: 'n' }, type: FieldType.number, values: [100, 200, 300] },
          { name: 'S', config: { displayName: 's' }, type: FieldType.string, values: ['1', '2', '3'] },
        ],
      }),
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'T', config: { displayName: 't2' }, type: FieldType.time, values: [1, 2, 3] }],
      }),
    ];

    const names = getAllFieldNamesFromDataFrames(frames, true);

    expect(names).toEqual(['T', 't', 'n', 's', 't2']);
  });
});

describe('detectMixedQueryResults', () => {
  it('returns false when all queries are successful', () => {
    const frames = [toDataFrame({ fields: [{ name: 'test', type: FieldType.string, values: ['a'] }] })];
    expect(detectMixedQueryResults(frames)).toBe(false);
  });

  it('returns true when some queries are successful and some are not', () => {
    const frames = [
      toDataFrame({ fields: [] }),
      toDataFrame({ fields: [{ name: 'test', type: FieldType.string, values: ['a'] }] }),
    ];
    expect(detectMixedQueryResults(frames)).toBe(true);
  });
});

describe('DataFieldsErrorWrapper', () => {
  const WrappedDashboard = DataFieldsErrorWrapper(GroupByTransformerEditorBase, { withBaseFieldNames: true });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('shows no error message if there are fields', () => {
    const mockProps = {
      input: [toDataFrame({ fields: [{ name: 'test', type: FieldType.string, values: ['a'] }] })],
      options: { fields: {} },
      onChange: jest.fn(),
    };
    render(createElement(WrappedDashboard, mockProps));
    expect(screen.queryByText(/One or more queries failed/)).not.toBeInTheDocument();
  });

  test('shows error message after debounce delay when there are no fields (e.g., datasource error or failed query', () => {
    const mockProps = {
      input: [toDataFrame({ fields: [] })],
      options: { fields: {} },
      onChange: jest.fn(),
    };

    render(createElement(WrappedDashboard, mockProps));

    // It should not show the error message immediately
    expect(screen.queryByText(/One or more queries failed/)).not.toBeInTheDocument();

    // It should show the error message after the debounce delay
    act(() => jest.advanceTimersByTime(TIMEOUT));
    expect(screen.getByText(/One or more queries failed/)).toBeInTheDocument();
  });

  test('shows error message for mixed query results (some successful, some failed)', () => {
    const mockProps = {
      input: [
        toDataFrame({
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'temperature', type: FieldType.number, values: [20, 21, 22] },
          ],
        }),
        toDataFrame({ refId: 'B', fields: [] }),
      ],
      options: { fields: {} },
      onChange: jest.fn(),
    };

    render(createElement(WrappedDashboard, mockProps));

    // It should not show the error message immediately
    expect(screen.queryByText(/One or more queries failed/)).not.toBeInTheDocument();

    // It should show the error message after the debounce delay
    act(() => jest.advanceTimersByTime(TIMEOUT));
    expect(screen.getByText(/One or more queries failed/)).toBeInTheDocument();

    // Should show available field names
    expect(screen.getByText('time')).toBeInTheDocument();
  });
});
