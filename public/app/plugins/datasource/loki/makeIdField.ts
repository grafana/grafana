import { v5 as uuidv5 } from 'uuid';

import { ArrayVector, DataFrame, Field, FieldType, Labels } from '@grafana/data';

const UUID_NAMESPACE = '6ec946da-0f49-47a8-983a-1d76d17e7c92';

function createUid(text: string, usedUids: Map<string, number>, refId?: string): string {
  const id = uuidv5(text, UUID_NAMESPACE);

  // check how many times have we seen this id before,
  // set the count to zero, if never.
  const count = usedUids.get(id) ?? 0;

  // if we have seen this id before, we need to make
  // it unique by appending the seen-count
  // (starts with 1, and goes up)
  const uniqueId = count > 0 ? `${id}_${count}` : id;

  // we increment the counter for this id, to be used when we are called the next time
  usedUids.set(id, count + 1);

  // we add refId to the end, if it is available
  return refId !== undefined ? `${uniqueId}_${refId}` : uniqueId;
}

export function makeIdField(frame: DataFrame): Field {
  const allLabels: Labels = {};

  // collect labels from every field
  frame.fields.forEach((field) => {
    Object.assign(allLabels, field.labels);
  });

  const labelsString = Object.entries(allLabels)
    .map(([key, val]) => `${key}="${val}"`)
    .sort()
    .join('');

  const usedUids = new Map<string, number>();

  const { length } = frame;

  const uids: string[] = new Array(length);

  // we need to go through the dataframe "row by row"
  for (let i = 0; i < length; i++) {
    const row = frame.fields.map((f) => String(f.values.get(i)));
    const text = `${labelsString}_${row.join('_')}`;
    const uid = createUid(text, usedUids, frame.refId);
    uids[i] = uid;
  }

  return { name: 'id', type: FieldType.string, config: {}, values: new ArrayVector(uids) };
}
