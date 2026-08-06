import { act, renderHook } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data';

import { compileFrameToRecords } from '../utils/rows';

import { useManagedSort, useSortedRows } from './sort';
import { setupData } from './testHelpers';

describe('useManagedSort', () => {
  it('Should not update if sortBy is undefined', () => {
    const setSortColumns = jest.fn();
    renderHook(() =>
      useManagedSort({
        sortBy: undefined,
        sortByBehavior: 'managed',
        setSortColumns,
      })
    );

    expect(setSortColumns).toHaveBeenCalledTimes(0);
  });

  it.each([true, false])('Should not update if behavior is managed', (desc) => {
    const setSortColumns = jest.fn();
    renderHook(() =>
      useManagedSort({
        sortBy: [
          {
            displayName: 'Alice',
            desc,
          },
        ],
        sortByBehavior: 'managed',
        setSortColumns,
      })
    );

    expect(setSortColumns).toHaveBeenCalledTimes(1);
    expect(setSortColumns).toHaveBeenCalledWith([
      {
        columnKey: 'Alice',
        direction: desc ? 'DESC' : 'ASC',
      },
    ]);
  });

  it.each([true, false])('Should not update if behavior is initial', (desc) => {
    const setSortColumns = jest.fn();
    renderHook(() =>
      useManagedSort({
        sortBy: [
          {
            displayName: 'Alice',
            desc,
          },
        ],
        sortByBehavior: 'initial',
        setSortColumns,
      })
    );

    expect(setSortColumns).toHaveBeenCalledTimes(0);
  });
});

describe('useSortedRows', () => {
  it('should correctly set up the table with an initial sort', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() =>
      useSortedRows(rows, fields, [], {
        initialSortBy: [{ displayName: 'age', desc: false }],
        hasNestedFrames: false,
      })
    );

    // Initial state checks
    expect(result.current.sortColumns).toEqual([{ columnKey: 'age', direction: 'ASC' }]);
    expect(result.current.rows[0].name).toBe('Bob');
  });

  it('should change the sort on setSortColumns', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() =>
      useSortedRows(rows, fields, [], {
        initialSortBy: [{ displayName: 'age', desc: false }],
        hasNestedFrames: false,
      })
    );

    expect(result.current.rows[0].name).toBe('Bob');

    act(() => {
      result.current.setSortColumns([{ columnKey: 'age', direction: 'DESC' }]);
    });

    expect(result.current.rows[0].name).toBe('Charlie');

    act(() => {
      result.current.setSortColumns([{ columnKey: 'name', direction: 'ASC' }]);
    });

    expect(result.current.rows[0].name).toBe('Alice');
  });

  it('should allow initial sort by nested fields', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.number, values: [1, 3, 2], config: {} },
        {
          name: 'nested',
          type: FieldType.nestedFrames,
          values: [[createDataFrame({ fields })], [createDataFrame({ fields })], [createDataFrame({ fields })]],
          config: {},
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );
    const rows = frameToRecords(frame);
    const { result } = renderHook(() =>
      useSortedRows(rows, frame.fields, fields, {
        initialSortBy: [
          { displayName: 'id', desc: false },
          { displayName: 'age', desc: false },
          { displayName: 'some-fake-name', desc: false },
        ],
        hasNestedFrames: true,
      })
    );
    expect(result.current.rows[0].id).toBe(1);
    expect(result.current.rows[2].id).toBe(2);
    expect(result.current.rows[4].id).toBe(3);

    // sort for the nested rows is handled elsewhere, and tested elsewhere. the most important thing is that the sort columns are set correctly
    // and that `age` is permitted as a sort column since it's from a nested field, and that `some-fake-name` is not permitted and is ignored.
    expect(result.current.sortColumns).toEqual([
      { columnKey: 'id', direction: 'ASC' },
      { columnKey: 'age', direction: 'ASC' },
    ]);
  });
});
