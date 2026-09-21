import { createDataFrame, FieldType } from '@grafana/data';

import { isProfileTruncated } from './profileSource';

function frame(labels: string[], marker?: boolean[]) {
  return createDataFrame({
    fields: [
      { name: 'label', type: FieldType.string, values: labels },
      { name: 'level', type: FieldType.number, values: labels.map((_, i) => i) },
      ...(marker ? [{ name: 'truncated', type: FieldType.boolean, values: marker }] : []),
    ],
  });
}

it('detects truncation anywhere in the original source, including hidden deep descendants', () => {
  expect(isProfileTruncated(frame(['total', 'visible', 'hidden', 'other']))).toBe(true);
  expect(isProfileTruncated(frame(['total', 'Other', 'otherwise']))).toBe(false);
});

it('uses an explicit marker instead of treating a genuine function named other as synthetic', () => {
  expect(isProfileTruncated(frame(['total', 'other'], [false, false]))).toBe(false);
  expect(isProfileTruncated(frame(['total', 'remainder'], [false, true]))).toBe(true);
});

it('uses raw enum identity rather than display capitalization or numeric enum indexes', () => {
  const data = createDataFrame({
    fields: [
      { name: 'label', type: FieldType.enum, values: [0, 1], config: { type: { enum: { text: ['total', 'other'] } } } },
    ],
  });
  expect(isProfileTruncated(data)).toBe(true);
});

it('detects a bucket contributed only by the right diff side', () => {
  const data = frame(['total', 'other']);
  data.fields.push(
    { name: 'value', type: FieldType.number, values: [10, 0], config: {} },
    { name: 'valueRight', type: FieldType.number, values: [20, 5], config: {} }
  );
  expect(isProfileTruncated(data)).toBe(true);
});
