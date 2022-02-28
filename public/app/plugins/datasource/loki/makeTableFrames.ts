import { DataFrame, Field, FieldType, ArrayVector } from '@grafana/data';
import { groupBy } from 'lodash';

export function makeTableFrames(instantMetricFrames: DataFrame[]): DataFrame[] {
  // first we remove frames that have no refId
  // (we will group them by refId, so we need it to be set)
  const framesWithRefId = instantMetricFrames.filter((f) => f.refId !== undefined);

  const framesByRefId = groupBy(framesWithRefId, (frame) => frame.refId);

  return Object.entries(framesByRefId).map(([refId, frames]) => makeTableFrame(frames, refId));
}

type NumberField = Field<number, ArrayVector<number>>;
type StringField = Field<string, ArrayVector<string>>;

function makeTableFrame(instantMetricFrames: DataFrame[], refId: string): DataFrame {
  const tableTimeField: NumberField = { name: 'Time', config: {}, values: new ArrayVector(), type: FieldType.time };
  const tableValueField: NumberField = {
    name: `Value #${refId}`,
    config: {},
    values: new ArrayVector(),
    type: FieldType.number,
  };

  // Sort metric labels, create columns for them and record their index
  const allLabelNames = new Set(
    instantMetricFrames.map((frame) => frame.fields.map((field) => Object.keys(field.labels ?? {})).flat()).flat()
  );

  const sortedLabelNames = Array.from(allLabelNames).sort();

  const labelFields: StringField[] = sortedLabelNames.map((labelName) => ({
    name: labelName,
    config: { filterable: true },
    values: new ArrayVector(),
    type: FieldType.string,
  }));

  instantMetricFrames.forEach((frame) => {
    const timeField = frame.fields.find((field) => field.type === FieldType.time);
    const valueField = frame.fields.find((field) => field.type === FieldType.number);
    if (timeField == null || valueField == null) {
      return;
    }

    const timeArray = timeField.values.toArray();
    const valueArray = valueField.values.toArray();

    for (let x of timeArray) {
      tableTimeField.values.add(x);
    }

    for (let x of valueArray) {
      tableValueField.values.add(x);
    }

    const labels = valueField.labels ?? {};

    for (let f of labelFields) {
      const text = labels[f.name] ?? '';
      // we insert the labels as many times as we have values
      for (let i = 0; i < valueArray.length; i++) {
        f.values.add(text);
      }
    }
  });

  return {
    fields: [tableTimeField, ...labelFields, tableValueField],
    refId,
    meta: { preferredVisualisationType: 'table' },
    length: tableTimeField.values.length,
  };
}
