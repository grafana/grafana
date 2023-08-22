import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

import { createStringFormatter, FormatStringOutput, formatStringTransformer } from './formatString';

const frame = toDataFrame({
  fields: [
    {
      name: 'names',
      type: FieldType.string,
      values: ["alice", "BOB", "CharliE", "david frederick attenborough", "Emma Fakename", ""],
    },
  ],
});

describe('Format String Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([formatStringTransformer]);
  });

  it('will convert string to upper case string', () => {
    const formatter = createStringFormatter('names', FormatStringOutput.UpperCase);
    const newFrame = formatter(frame.fields);
    expect(newFrame[0].values).toEqual(["ALICE", "BOB", "CHARLIE", "DAVID FREDERICK ATTENBOROUGH", "EMMA FAKENAME", ""]);
  });

  it('will convert string to lower case string', () => {
    const formatter = createStringFormatter('names', FormatStringOutput.LowerCase);
    const newFrame = formatter(frame.fields);
    expect(newFrame[0].values).toEqual(["alice", "bob", "charlie", "david frederick attenborough", "emma fakename", ""]);
  });

  it('will capitalize first letter of a string', () => {
    const formatter = createStringFormatter('names', FormatStringOutput.FirstLetter);
    const newFrame = formatter(frame.fields);
    expect(newFrame[0].values).toEqual(["Alice", "BOB", "CharliE", "David frederick attenborough", "Emma Fakename", ""]);
  });

  it('will capitalize first letter of every word in a string', () => {
    const formatter = createStringFormatter('names', FormatStringOutput.EveryFirstLetter);
    const newFrame = formatter(frame.fields);
    expect(newFrame[0].values).toEqual(["Alice", "BOB", "CharliE", "David Frederick Attenborough", "Emma Fakename", ""]);
  });

  it('will convert string to pascal case', () => {
    const formatter = createStringFormatter('names', FormatStringOutput.PascalCase);
    const newFrame = formatter(frame.fields);
    expect(newFrame[0].values).toEqual(["Alice", "Bob", "Charlie", "DavidFrederickAttenborough", "EmmaFakename", ""]);
  });

  it('will convert string to camel case', () => {
    const formatter = createStringFormatter('names', FormatStringOutput.CamelCase);
    const newFrame = formatter(frame.fields);
    expect(newFrame[0].values).toEqual(["alice", "bob", "charlie", "davidFrederickAttenborough", "emmaFakename", ""]);
  });
});
