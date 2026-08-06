import { useMemo } from 'react';

import { FieldType, formattedValueToString, reduceField, ReducerID, type Field } from '@grafana/data';

import { type FooterFieldState, type TableRow } from '../types';

const isReducer = (maybeReducer: string): maybeReducer is ReducerID => maybeReducer in ReducerID;
const nonMathReducers = new Set<ReducerID>([
  ReducerID.allValues,
  ReducerID.changeCount,
  ReducerID.count,
  ReducerID.countAll,
  ReducerID.distinctCount,
  ReducerID.first,
  ReducerID.firstNotNull,
  ReducerID.last,
  ReducerID.lastNotNull,
  ReducerID.uniqueValues,
]);
const isNonMathReducer = (reducer: string) => isReducer(reducer) && nonMathReducers.has(reducer);
const noFormattingReducers = new Set<ReducerID>([ReducerID.count, ReducerID.countAll]);
const shouldReducerSkipFormatting = (reducer: string) => isReducer(reducer) && noFormattingReducers.has(reducer);

export const useReducerEntries = (
  field: Field,
  rows: TableRow[],
  displayName: string,
  colIdx: number
): Array<[string, string | null]> => {
  return useMemo(() => {
    const reducers: string[] = field.config.custom?.footer?.reducers ?? [];

    if (
      reducers.length === 0 ||
      (field.type !== FieldType.number && reducers.every((reducerId) => !isNonMathReducer(reducerId)))
    ) {
      return [];
    }

    // Create a new state object that matches the original behavior exactly
    const newState: FooterFieldState = {
      lastProcessedRowCount: 0,
      ...(field.state || {}), // Preserve any existing state properties
    };

    // Assign back to field
    field.state = newState;

    const currentRowCount = rows.length;
    const lastRowCount = newState.lastProcessedRowCount;

    // Check if we need to invalidate the cache
    if (lastRowCount !== currentRowCount) {
      // Cache should be invalidated as row count has changed
      if (newState.calcs) {
        delete newState.calcs;
      }
      // Update the row count tracker
      newState.lastProcessedRowCount = currentRowCount;
    }

    // Calculate all specified reducers
    const results: Record<string, number | null> = reduceField({
      field: {
        ...field,
        values: rows.map((row) => row[displayName]),
      },
      reducers,
    });

    return reducers.map((reducerId) => {
      if (
        results[reducerId] === undefined ||
        // For non-number fields, only show special count reducers
        (field.type !== FieldType.number && !isNonMathReducer(reducerId)) ||
        // for countAll, only show the reducer in the first column
        (reducerId === ReducerID.countAll && colIdx !== 0)
      ) {
        return [reducerId, null];
      }

      const value = results[reducerId];
      let result = null;
      if (!shouldReducerSkipFormatting(reducerId) && field.display) {
        result = formattedValueToString(field.display(value));
      } else if (value != null) {
        result = String(value);
      }

      return [reducerId, result];
    });
  }, [field, rows, displayName, colIdx]);
};
