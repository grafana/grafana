import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import {
  createStringFormatter,
  FormatStringOutput,
  formatStringTransformer,
  getFormatStringFunction,
} from './formatString';

const frame = toDataFrame({
  fields: [
    {
      name: 'names',
      type: FieldType.string,
      values: ['alice', 'BOB', 'CharliE', 'david frederick attenborough', 'Emma Fakename', ''],
    },
  ],
});

const fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get('names');

describe('Format String Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([formatStringTransformer]);
  });

  it('will convert string to upper case', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.UpperCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['ALICE', 'BOB', 'CHARLIE', 'DAVID FREDERICK ATTENBOROUGH', 'EMMA FAKENAME', '']);
  });

  it('will convert string to lower case', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.LowerCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['alice', 'bob', 'charlie', 'david frederick attenborough', 'emma fakename', '']);
  });

  it('will capitalize first letter of a string', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.SentenceCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['Alice', 'BOB', 'CharliE', 'David frederick attenborough', 'Emma Fakename', '']);
  });

  it('will capitalize first letter of every word in a string', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.TitleCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['Alice', 'Bob', 'Charlie', 'David Frederick Attenborough', 'Emma Fakename', '']);
  });

  it('will convert string to pascal case', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.PascalCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['Alice', 'Bob', 'Charlie', 'DavidFrederickAttenborough', 'EmmaFakename', '']);
  });

  it('will convert string to camel case', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.CamelCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['alice', 'bob', 'charlie', 'davidFrederickAttenborough', 'emmaFakename', '']);
  });

  it('will convert string to snake case', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.SnakeCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['alice', 'bob', 'charlie', 'david_frederick_attenborough', 'emma_fakename', '']);
  });

  it('will convert string to kebab case', () => {
    const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(FormatStringOutput.KebabCase));
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['alice', 'bob', 'charlie', 'david-frederick-attenborough', 'emma-fakename', '']);
  });
});
