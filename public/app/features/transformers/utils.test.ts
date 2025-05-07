import { FieldType, toDataFrame } from '@grafana/data';

import { getAllFieldNamesFromDataFrames, numberOrVariableValidator } from './utils';

describe('validator', () => {
  it('validates a positive number', () => {
    expect(numberOrVariableValidator(1)).toBe(true);
  });

  it('validates a negative number', () => {
    expect(numberOrVariableValidator(-1)).toBe(true);
  });

  it('validates zero', () => {
    expect(numberOrVariableValidator(0)).toBe(true);
  });

  it('validates a float', () => {
    expect(numberOrVariableValidator(1.2)).toBe(true);
  });

  it('validates a negative float', () => {
    expect(numberOrVariableValidator(1.2)).toBe(true);
  });

  it('validates a string that is a positive integer', () => {
    expect(numberOrVariableValidator('1')).toBe(true);
  });

  it('validats a string that is a negative integer', () => {
    expect(numberOrVariableValidator('-1')).toBe(true);
  });

  it('validats a string that is zero', () => {
    expect(numberOrVariableValidator('0')).toBe(true);
  });

  it('validats a string that is a float', () => {
    expect(numberOrVariableValidator('1.2')).toBe(true);
  });

  it('validats a string that is a negative float', () => {
    expect(numberOrVariableValidator('-1.2')).toBe(true);
  });

  it('fails a string that is not a number', () => {
    expect(numberOrVariableValidator('foo')).toBe(false);
  });

  it('validates a string that has a variable', () => {
    expect(numberOrVariableValidator('$foo')).toBe(true);
  });

  it('fails a string that has multiple variables', () => {
    expect(numberOrVariableValidator('$foo$asd')).toBe(false);
  });
});

describe('useAllFieldNamesFromDataFrames', () => {
  it('gets base and full field names', () => {
    let frames = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'T', type: FieldType.time, values: [1, 2, 3] },
          { name: 'N', type: FieldType.number, values: [100, 200, 300] },
          { name: 'S', type: FieldType.string, values: ['1', '2', '3'] },
        ],
      }),
      toDataFrame({
        refId: 'B',
        fields: [
          { name: 'T', type: FieldType.time, values: [1, 2, 3] },
          { name: 'N', type: FieldType.number, values: [100, 200, 300] },
          { name: 'S', type: FieldType.string, values: ['1', '2', '3'] },
        ],
      }),
    ].map((frame) => ({
      ...frame,
      fields: frame.fields.map((field) => ({
        ...field,
        state: {
          multipleFrames: true,
          displayName: `${field.name} (${frame.refId})`,
        },
      })),
    }));

    const names = getAllFieldNamesFromDataFrames(frames, true);

    expect(names).toEqual(['T', 'N', 'S', 'T (A)', 'N (A)', 'S (A)', 'T (B)', 'N (B)', 'S (B)']);
  });

  it('omit base names when field.name is unique', () => {
    let frames = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'T', config: { displayName: 't' }, type: FieldType.time, values: [1, 2, 3] },
          { name: 'N', config: { displayName: 'n' }, type: FieldType.number, values: [100, 200, 300] },
          { name: 'S', config: { displayName: 's' }, type: FieldType.string, values: ['1', '2', '3'] },
        ],
      }),
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'T', config: { displayName: 't2' }, type: FieldType.time, values: [1, 2, 3] }],
      }),
    ];

    const names = getAllFieldNamesFromDataFrames(frames, true);

    expect(names).toEqual(['T', 't', 'n', 's', 't2']);
  });
});
