import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { type DataFrame, type Field, FieldType } from '../../types/dataFrame';
import { type DataTransformerInfo } from '../../types/transformations';
import { fieldReducers, getFieldTypeForReducer, reduceField, ReducerID } from '../fieldReducer';

import { DataTransformerID } from './ids';

export interface PivotField {
  name: string;
  labels?: Record<string, string>;
}
export interface PivotMeasure {
  field: PivotField;
  reducer: string;
  footerReducers: string[];
}
export interface PivotOptions {
  frameIndex: number;
  rows: PivotField[];
  columns: PivotField[];
  values: PivotMeasure[];
  totalRow: boolean;
  totalColumns: boolean;
}
export interface PivotProvenance {
  source: DataFrame;
  groups: number[][];
  columns: Map<string, { source: Field; indices: Set<number>; footerReducers: string[] }>;
  error?: string;
}

// Field overrides preserve frame metadata. Keep raw-record provenance runtime-only and outside serialized panel data.
const provenance = new WeakMap<object, PivotProvenance>();
export const getPivotProvenance = (frame: DataFrame) => frame.meta && provenance.get(frame.meta);
export const pivotFieldKey = (field: PivotField) =>
  JSON.stringify([field.name, Object.entries(field.labels ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))]);
export const isPivotScalar = (field: Field) =>
  [FieldType.number, FieldType.string, FieldType.boolean, FieldType.time, FieldType.enum].includes(field.type);
const scalarReducers = new Set<string>([
  ReducerID.count,
  ReducerID.countAll,
  ReducerID.distinctCount,
  ReducerID.first,
  ReducerID.firstNotNull,
  ReducerID.last,
  ReducerID.lastNotNull,
  ReducerID.changeCount,
]);
export const supportsPivotReducer = (field: Field, reducer: string) =>
  Boolean(fieldReducers.getIfExists(reducer)) &&
  (scalarReducers.has(reducer) ||
    (field.type === FieldType.number && reducer !== ReducerID.allValues && reducer !== ReducerID.uniqueValues));

function tupleKey(values: unknown[]) {
  return JSON.stringify(values.map((value) => [typeof value, typeof value === 'number' ? String(value) : value]));
}

export function pivotFrame(frame: DataFrame, options: PivotOptions): DataFrame {
  const resolve = (selection: PivotField) => {
    const matches = frame.fields.filter((field) => pivotFieldKey(field) === pivotFieldKey(selection));
    if (matches.length !== 1 || !isPivotScalar(matches[0])) {
      throw new Error(`Pivot field "${selection.name}" is missing, ambiguous, or unsupported.`);
    }
    return matches[0];
  };
  if (!options.rows.length || !options.values.length) {
    throw new Error('Choose at least one Rows field and one Values calculation.');
  }
  const dimensions = [...options.rows, ...options.columns].map(pivotFieldKey);
  if (new Set(dimensions).size !== dimensions.length) {
    throw new Error('Each dimension can appear only once in Rows or Columns.');
  }
  const measures = options.values.map((value) => `${pivotFieldKey(value.field)}:${value.reducer}`);
  if (new Set(measures).size !== measures.length) {
    throw new Error('Choose different calculations for repeated value fields.');
  }
  const rowFields = options.rows.map(resolve);
  const columnFields = options.columns.map(resolve);
  const valueFields = options.values.map((value) => {
    const field = resolve(value.field);
    if (![value.reducer, ...value.footerReducers].every((reducer) => supportsPivotReducer(field, reducer))) {
      throw new Error(`Unsupported calculation for "${field.name}".`);
    }
    return field;
  });
  const checkSize = (columnCount: number, rowCount: number) => {
    const width = (columnCount + Number(options.totalColumns && columnFields.length > 0)) * valueFields.length;
    if (width > 1000 || (width + rowFields.length) * rowCount > 1_000_000) {
      throw new Error('Pivot is too large. Choose fewer Columns fields or filter source records first.');
    }
  };
  const rows = new Map<string, { values: unknown[]; indices: number[] }>();
  const columns = new Map<string, { values: unknown[]; indices: Set<number> }>();
  const intersections = new Map<string, Map<string, number[]>>();
  for (let i = 0; i < frame.length; i++) {
    const rowValues = rowFields.map((field) => field.values[i]);
    const columnValues = columnFields.map((field) => field.values[i]);
    const rowKey = tupleKey(rowValues);
    const columnKey = tupleKey(columnValues);
    if (!rows.has(rowKey)) {
      rows.set(rowKey, { values: rowValues, indices: [] });
      intersections.set(rowKey, new Map());
    }
    if (!columns.has(columnKey)) {
      columns.set(columnKey, { values: columnValues, indices: new Set() });
    }
    rows.get(rowKey)!.indices.push(i);
    columns.get(columnKey)!.indices.add(i);
    const cells = intersections.get(rowKey)!;
    if (!cells.has(columnKey)) {
      cells.set(columnKey, []);
    }
    cells.get(columnKey)!.push(i);
    checkSize(columns.size, rows.size);
  }
  if (!columnFields.length && !columns.size) {
    columns.set(tupleKey([]), { values: [], indices: new Set() });
  }
  checkSize(columns.size, rows.size);
  const rowGroups = Array.from(rows.values());
  const metadata: PivotProvenance = {
    source: frame,
    groups: rowGroups.map((group) => group.indices),
    columns: new Map(),
  };
  const usedNames = new Set<string>();
  const uniqueName = (label: string) => {
    let name = label;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${label} (${suffix++})`;
    }
    usedNames.add(name);
    return name;
  };
  const fields: Field[] = rowFields.map((field, index) => ({
    ...field,
    name: uniqueName(getFieldDisplayName(field)),
    state: undefined,
    values: rowGroups.map((group) => group.values[index]),
    config: { ...field.config, displayName: undefined, displayNameFromDS: undefined },
  }));
  const addMeasures = (label: string[], indices: Set<number>, columnKey?: string) => {
    options.values.forEach((value, index) => {
      const source = valueFields[index];
      const name = uniqueName(
        [...label, getFieldDisplayName(source), fieldReducers.get(value.reducer).name].join(' · ')
      );
      fields.push({
        name,
        type: getFieldTypeForReducer(Object.values(ReducerID).find((id) => id === value.reducer)!, source.type),
        config: { unit: fieldReducers.get(value.reducer).preservesUnits ? source.config.unit : undefined },
        values: Array.from(rows.entries()).map(([rowKey, group]) => {
          const selection = columnKey === undefined ? group.indices : intersections.get(rowKey)!.get(columnKey);
          return selection?.length ? reducePivotRecords(source, selection, [value.reducer])[value.reducer] : null;
        }),
      });
      metadata.columns.set(name, { source, indices, footerReducers: value.footerReducers });
    });
  };
  columns.forEach((column, key) =>
    addMeasures(
      column.values.map((value) => (value == null ? '(blank)' : String(value))),
      column.indices,
      key
    )
  );
  if (options.totalColumns && columnFields.length) {
    addMeasures(['Grand total'], new Set(rowGroups.flatMap((group) => group.indices)));
  }
  const result = { ...frame, refId: `pivot-${frame.refId}`, fields, length: rows.size, meta: { ...frame.meta } };
  provenance.set(result.meta, metadata);
  return result;
}

export function reducePivotRecords(field: Field, indices: number[], reducers: string[]) {
  return reduceField({
    field: { ...field, state: undefined, values: indices.map((index) => field.values[index]) },
    reducers,
  });
}

export function pivotFooter(metadata: PivotProvenance, field: Field, rowIndices: number[], reducers: string[]) {
  const column = metadata.columns.get(field.name);
  if (!column) {
    return {};
  }
  const indices = rowIndices
    .flatMap((index) => metadata.groups[index] ?? [])
    .filter((index) => column.indices.has(index));
  return reducePivotRecords(column.source, indices, reducers);
}

export const pivotTransformer: DataTransformerInfo<PivotOptions> = {
  id: DataTransformerID.pivot,
  name: 'Pivot',
  description: 'Group rows and columns and aggregate selected values.',
  defaultOptions: { frameIndex: 0, rows: [], columns: [], values: [], totalRow: true, totalColumns: true },
  operator: (options) => (source) =>
    source.pipe(
      map((frames) =>
        frames.map((frame, index) => {
          if (index !== options.frameIndex) {
            return frame;
          }
          try {
            return pivotFrame(frame, options);
          } catch (error) {
            const result = { ...frame, meta: { ...frame.meta } };
            provenance.set(result.meta, { source: frame, groups: [], columns: new Map(), error: String(error) });
            return result;
          }
        })
      )
    ),
};
