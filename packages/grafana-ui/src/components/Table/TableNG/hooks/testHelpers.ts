import { type Field, FieldType } from '@grafana/data';

import { applyFilter } from '../utils/filter';

// Shared by the hook test files in this folder, which used to live together in hooks.test.ts.
export function setupData() {
  // Mock data for testing
  const fields: Field[] = [
    {
      name: 'name',
      type: FieldType.string,
      display: (v) => ({ text: v as string, numeric: NaN }),
      config: {},
      values: ['Alice', 'Bob', 'Charlie'],
    },
    {
      name: 'age',
      type: FieldType.number,
      display: (v) => ({ text: (v as number).toString(), numeric: v as number }),
      config: {},
      values: [30, 25, 35],
    },
    {
      name: 'active',
      type: FieldType.boolean,
      display: (v) => ({ text: (v as boolean).toString(), numeric: NaN }),
      config: {},
      values: [true, false, true],
    },
  ];

  const rows = [
    { name: 'Alice', age: 30, active: true, __depth: 0, __index: 0 },
    { name: 'Bob', age: 25, active: false, __depth: 0, __index: 1 },
    { name: 'Charlie', age: 35, active: true, __depth: 0, __index: 2 },
  ];

  return { fields, rows };
}

export const emptyFilterResult = applyFilter([], {}, []);
