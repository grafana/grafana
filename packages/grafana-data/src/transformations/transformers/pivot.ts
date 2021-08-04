import { uniq, last, min, max, sum, mean } from 'lodash';
import { map } from 'rxjs/operators';
import { ReducerID } from './../fieldReducer';
import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { MutableDataFrame } from '../../dataframe';
import { FieldType, SelectableValue, Field } from '../../types';

export type PivotAggregation =
  | ReducerID.first
  | ReducerID.firstNotNull
  | ReducerID.count
  | ReducerID.sum
  | ReducerID.mean
  | ReducerID.min
  | ReducerID.max
  | ReducerID.last
  | ReducerID.lastNotNull;

export const PivotAggregationOptions: Array<SelectableValue<PivotAggregation>> = [
  { value: ReducerID.first, label: 'First' },
  { value: ReducerID.firstNotNull, label: 'First non null' },
  { value: ReducerID.count, label: 'Count' },
  { value: ReducerID.sum, label: 'Sum' },
  { value: ReducerID.mean, label: 'Mean' },
  { value: ReducerID.min, label: 'Min' },
  { value: ReducerID.max, label: 'Max' },
  { value: ReducerID.last, label: 'Last' },
  { value: ReducerID.lastNotNull, label: 'Last non null' },
];

const isNumericAggregation = (aggregationType: PivotAggregation): boolean => {
  return [ReducerID.count, ReducerID.sum, ReducerID.mean, ReducerID.min, ReducerID.max].includes(aggregationType);
};

const getAggregatedValue = (valueItems: unknown[], aggregation: PivotAggregation): unknown => {
  let nonNullItems = valueItems.filter(Boolean);
  switch (aggregation) {
    case ReducerID.first:
      return valueItems[0];
    case ReducerID.firstNotNull:
      return nonNullItems[0];
    case ReducerID.count:
      return valueItems.length;
    case ReducerID.sum:
      return sum(nonNullItems);
    case ReducerID.mean:
      return nonNullItems.length > 0 ? mean(nonNullItems) : null;
    case ReducerID.min:
      return min(nonNullItems);
    case ReducerID.max:
      return max(nonNullItems);
    case ReducerID.last:
      return last(valueItems);
    case ReducerID.lastNotNull:
      return last(nonNullItems);
    default:
      return last(valueItems);
  }
};

export interface PivotTransformerOptions {
  row: string;
  column: string;
  metric: string;
  aggregation: PivotAggregation;
}

const getFieldName = (field: Field<any>): string => {
  return field.state?.displayName ? field.state.displayName : field.name;
};

export const pivotTransformer: DataTransformerInfo<PivotTransformerOptions> = {
  name: 'Pivot',
  description: 'Pivot fields',
  id: DataTransformerID.pivot,
  defaultOptions: {
    row: '',
    column: '',
    metric: '',
    aggregation: 'last',
  },
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        return data.map((frame) => {
          if (options.row && options.column && options.metric) {
            const matchedColumn = frame.fields.find((f) => getFieldName(f) === options.column);
            const matchedRow = frame.fields.find((f) => getFieldName(f) === options.row);
            const metric = frame.fields.find((f) => getFieldName(f) === options.metric);
            if (matchedRow && matchedColumn && metric) {
              const columns = matchedColumn ? uniq(matchedColumn.values.toArray()) : [];
              const rows = matchedRow ? uniq(matchedRow.values.toArray()) : [];
              const resultType =
                (metric && metric.type === FieldType.number) || (metric && isNumericAggregation(options.aggregation))
                  ? FieldType.number
                  : metric.type;
              const values: Array<Record<string, unknown>> = [];
              for (let i = 0; i < frame.length; i++) {
                let o: Record<string, any> = {};
                frame.fields.forEach((field) => {
                  o[getFieldName(field)] = field.values.get(i);
                });
                values.push(o);
              }
              const newFrame = new MutableDataFrame({
                name: frame.name || frame.refId || `pivot-results`,
                fields: [options.row, ...columns].map((c, index) => {
                  const filteredValues = values.filter((v) => v[options.column] === c);
                  return {
                    name: c || 'null',
                    type: index === 0 ? FieldType.string : resultType,
                    values:
                      index === 0
                        ? rows
                        : rows.map((row) => {
                            const valueItems = filteredValues
                              .filter((v) => v[options.row] === row)
                              .map((c) => (c ? c[options.metric] : null));
                            return getAggregatedValue(valueItems, options.aggregation);
                          }),
                  };
                }),
              });
              return newFrame;
            } else {
              return frame;
            }
          }
          return frame;
        });
      })
    ),
};
