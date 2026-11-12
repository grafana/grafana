import { applyFieldOverrides, createTheme, type DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { TableCellDisplayMode } from '../types';

// Shared helpers for test data frame construction
export const withFieldOverrides = (frame: ReturnType<typeof toDataFrame>): DataFrame =>
  applyFieldOverrides({
    data: [frame],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];

export const stdCellConfig = {
  custom: { width: 150, cellOptions: { type: TableCellDisplayMode.Auto, wrapText: false } },
};

const makeDisplay = (toNumeric: (v: unknown) => number) => (value: unknown) => ({
  text: String(value),
  numeric: toNumeric(value),
  color: undefined,
  prefix: undefined,
  suffix: undefined,
});

export const displayString = makeDisplay(() => 0);
export const displayNumber = makeDisplay((v: unknown) => Number(v));
export const stdField = { state: {}, getLinks: () => [] };

// A `FieldType.other` column, which the Auto cell pretty-prints as JSON.
export const createJsonDataFrame = (wrapText: boolean): DataFrame =>
  withFieldOverrides(
    toDataFrame({
      name: 'JsonData',
      length: 1,
      fields: [
        {
          name: 'service',
          type: FieldType.string,
          values: ['gateway'],
          config: stdCellConfig,
          display: displayString,
          ...stdField,
        },
        {
          name: 'metadata',
          type: FieldType.other,
          values: [{ region: 'us-east-1', replicas: 3 }],
          config: { custom: { ...stdCellConfig.custom, wrapText } },
          ...stdField,
        },
      ],
    })
  );

export function wrappedFrame(values: string[]) {
  return withFieldOverrides(
    toDataFrame({
      fields: [
        {
          name: 'message',
          type: FieldType.string,
          values,
          config: { custom: { wrapText: true, width: 300 } },
        },
      ],
    })
  );
}
