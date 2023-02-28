import {
  ArrayVector,
  DataFrame,
  Field,
  FieldType,
  DataFrameType,
  getFieldDisplayName,
  Labels,
  formatLabels,
} from '@grafana/data';

interface LabelInfo {
  key: string;
  labels: Labels;
  index: number;
}

// This function should eventually live in a transformation
export function toNumericLong(data: DataFrame[]): DataFrame {
  // noop if this is already numeric long
  if (data.length === 1 && data[0].meta?.type === DataFrameType.NumericLong) {
    return data[0];
  }

  let first: Field | undefined = undefined;
  const uniqueLabels = new Map<string, string[]>();
  const labelInfo = new Map<string, LabelInfo>();
  const labeledNumbers = new Map<string, number[]>();
  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        if (field.labels) {
          if (!first) {
            first = field;
          }
          const key = formatLabels(field.labels);
          let info = labelInfo.get(key);
          if (!info) {
            info = {
              key,
              labels: field.labels,
              index: labelInfo.size,
            };
            labelInfo.set(key, info);

            // Fill in the unique values
            for (const [key, value] of Object.entries(field.labels)) {
              let v = uniqueLabels.get(key);
              if (!v) {
                v = [];
                uniqueLabels.set(key, v);
              }
              v[info.index] = value;
            }
          }
          field.values.toArray().forEach((v, index) => {
            const name = index === 0 ? field.name : `${field.name} (${index + 1})`;
            let values = labeledNumbers.get(name);
            if (!values) {
              values = [];
              labeledNumbers.set(name, values);
            }
            values[info!.index] = v;
          });
        }
      }
    }
  }
  if (labeledNumbers.size) {
    const frame: DataFrame = {
      name: data[0].name,
      refId: data[0].refId,
      meta: {
        ...data[0].meta,
        type: DataFrameType.NumericLong,
      },
      fields: [],
      length: labelInfo.size,
    };
    labeledNumbers.forEach((value, key) => {
      frame.fields.push({
        name: key,
        type: FieldType.number,
        config: first?.config ?? {},
        values: new ArrayVector(value),
      });
    });

    uniqueLabels.forEach((value, key) => {
      frame.fields.push({
        name: key,
        type: FieldType.string,
        config: {},
        values: new ArrayVector(value),
      });
    });
    return frame;
  }

  // Labels were not used, default to simple name+value pair
  const names: string[] = [];
  const values: number[] = [];
  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        if (!first) {
          first = field;
        }
        const name = getFieldDisplayName(field, frame, data);
        field.values.toArray().forEach((v) => {
          names.push(name);
          values.push(v);
        });
      }
    }
  }
  return {
    name: data[0].name,
    refId: data[0].refId,
    meta: {
      ...data[0].meta,
      type: DataFrameType.NumericLong,
    },
    fields: [
      { name: 'Name', type: FieldType.string, values: new ArrayVector(names), config: {} },
      { name: 'Value', type: FieldType.number, values: new ArrayVector(values), config: first?.config ?? {} },
    ],
    length: values.length,
  };
}
