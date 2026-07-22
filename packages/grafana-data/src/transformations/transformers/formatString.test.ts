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
      values: ['alice', 'BOB', '  charliE  ', 'david frederick attenborough', 'Emma Fakename', ''],
    },
  ],
});

const frameWithNulls = toDataFrame({
  fields: [
    {
      name: 'names',
      type: FieldType.string,
      values: ['alice', null, 'BOB', undefined, 'david'],
    },
  ],
});

const fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get('names');

const options = (format: FormatStringOutput, substringStart?: number, substringEnd?: number) => {
  return {
    stringField: 'names',
    substringStart: substringStart ?? 0,
    substringEnd: substringEnd ?? 100,
    outputFormat: format,
  };
};

describe('Format String Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([formatStringTransformer]);
  });

  it('will convert string to each case', () => {
    const formats = [
      FormatStringOutput.UpperCase,
      FormatStringOutput.LowerCase,
      FormatStringOutput.SentenceCase,
      FormatStringOutput.TitleCase,
      FormatStringOutput.PascalCase,
      FormatStringOutput.CamelCase,
      FormatStringOutput.SnakeCase,
      FormatStringOutput.KebabCase,
      FormatStringOutput.Trim,
    ];
    const newValues = [];

    for (let i = 0; i < formats.length; i++) {
      const formatter = createStringFormatter(fieldMatches, getFormatStringFunction(options(formats[i])));
      const newFrame = formatter(frame, [frame]);
      newValues.push(newFrame[0].values);
    }

    const answers = [
      ['ALICE', 'BOB', '  CHARLIE  ', 'DAVID FREDERICK ATTENBOROUGH', 'EMMA FAKENAME', ''], // Upper Case
      ['alice', 'bob', '  charlie  ', 'david frederick attenborough', 'emma fakename', ''], // Lower Case
      ['Alice', 'BOB', '  charliE  ', 'David frederick attenborough', 'Emma Fakename', ''], // Sentence Case
      ['Alice', 'Bob', '  Charlie  ', 'David Frederick Attenborough', 'Emma Fakename', ''], // Title Case
      ['Alice', 'Bob', 'Charlie', 'DavidFrederickAttenborough', 'EmmaFakename', ''], // Pascal Case
      ['alice', 'bob', 'charlie', 'davidFrederickAttenborough', 'emmaFakename', ''], // Camel Case
      ['alice', 'bob', '__charlie__', 'david_frederick_attenborough', 'emma_fakename', ''], // Snake Case
      ['alice', 'bob', '--charlie--', 'david-frederick-attenborough', 'emma-fakename', ''], // Kebab Case
      ['alice', 'BOB', 'charliE', 'david frederick attenborough', 'Emma Fakename', ''], // Trim
    ];

    expect(newValues).toEqual(answers);
  });

  it('will convert string to substring', () => {
    const formatter = createStringFormatter(
      fieldMatches,
      getFormatStringFunction(options(FormatStringOutput.Substring, 2, 5))
    );
    const newFrame = formatter(frame, [frame]);
    const newValues = newFrame[0].values;

    expect(newValues).toEqual(['ice', 'B', 'cha', 'vid', 'ma ', '']);
  });

  it('will pass null and undefined values through unchanged', () => {
    const formats = [
      FormatStringOutput.UpperCase,
      FormatStringOutput.LowerCase,
      FormatStringOutput.TitleCase,
      FormatStringOutput.Trim,
      FormatStringOutput.Substring,
    ];

    for (const format of formats) {
      const formatter = createStringFormatter(
        fieldMatches,
        getFormatStringFunction(options(format, 1, 3))
      );
      const newFrame = formatter(frameWithNulls, [frameWithNulls]);
      const newValues = newFrame[0].values;

      expect(newValues).toEqual(['alice', null, 'BOB', undefined, 'david']);
    }
  });
});
