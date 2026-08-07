import { renderHook } from '@testing-library/react';

import { ReducerID } from '@grafana/data';

import { useReducerEntries } from './footer';
import { setupData } from './testHelpers';

describe('useReducerEntries', () => {
  it('should return the correct reducers for a field', () => {
    const { fields, rows } = setupData();
    fields[0].config.custom = {
      footer: {
        reducers: [ReducerID.first],
      },
    };
    fields[1].config.custom = {
      footer: {
        reducers: [ReducerID.mean, 'max', 'min', ReducerID.first],
      },
    };

    const { result } = renderHook(() => useReducerEntries(fields[0], rows, 'name', 0));
    expect(result.current).toEqual([[ReducerID.first, 'Alice']]);

    const { result: result2 } = renderHook(() => useReducerEntries(fields[1], rows, 'age', 0));
    expect(result2.current).toEqual([
      [ReducerID.mean, '30'],
      ['max', '35'],
      ['min', '25'],
      [ReducerID.first, '30'],
    ]);
  });

  it('should return an empty array if no reducers are configured', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() => useReducerEntries(fields[0], rows, 'name', 0));
    expect(result.current).toEqual([]);
  });

  it('should return an empty array if all of the reducers are numeric and the field non-numeric', () => {
    const { fields, rows } = setupData();
    fields[0].config.custom = {
      footer: {
        reducers: [ReducerID.mean, 'max'],
      },
    };

    const { result } = renderHook(() => useReducerEntries(fields[0], rows, 'name', 0));
    expect(result.current).toEqual([]);
  });

  it('should return null for non-numeric fields for numeric reducers', () => {
    const { fields, rows } = setupData();
    fields[0].config.custom = {
      footer: {
        reducers: [ReducerID.mean, ReducerID.first],
      },
    };
    const { result } = renderHook(() => useReducerEntries(fields[0], rows, 'name', 0));
    expect(result.current).toEqual([
      [ReducerID.mean, null],
      [ReducerID.first, 'Alice'],
    ]);
  });

  it('should return null when the colIdx is not 0 for the countAll reducer', () => {
    const { fields, rows } = setupData();
    fields[0].config.custom = {
      footer: {
        reducers: [ReducerID.countAll, ReducerID.first],
      },
    };

    const { result } = renderHook(() => useReducerEntries(fields[0], rows, 'name', 1));
    expect(result.current).toEqual([
      [ReducerID.countAll, null],
      [ReducerID.first, 'Alice'],
    ]);
  });

  it('should return null (and should not throw) for an unknown reducer', () => {
    const { fields, rows } = setupData();
    fields[0].config.custom = {
      footer: {
        reducers: ['unknownReducer', ReducerID.first],
      },
    };

    const { result } = renderHook(() => useReducerEntries(fields[0], rows, 'name', 0));
    expect(result.current).toEqual([
      ['unknownReducer', null],
      [ReducerID.first, 'Alice'],
    ]);
  });

  it('should format the value for most reducers', () => {
    const { fields, rows } = setupData();
    fields[1].config.custom = {
      footer: {
        reducers: [ReducerID.mean, ReducerID.first],
      },
    };
    fields[1].display = (v) => ({ text: `$${v}`, numeric: v as number });
    const { result } = renderHook(() => useReducerEntries(fields[1], rows, 'age', 0));
    expect(result.current).toEqual([
      [ReducerID.mean, '$30'],
      [ReducerID.first, '$30'],
    ]);
  });

  it.each([ReducerID.count, ReducerID.countAll])('should not format the value for the %s reducer', (reducerId) => {
    const { fields, rows } = setupData();
    fields[1].config.custom = {
      footer: {
        reducers: [reducerId, ReducerID.first],
      },
    };
    fields[1].display = (v) => ({ text: `${v} years`, numeric: v as number });

    const { result } = renderHook(() => useReducerEntries(fields[1], rows, 'age', 0));
    expect(result.current).toEqual([
      [reducerId, '3'],
      [ReducerID.first, '30 years'],
    ]);
  });
});
