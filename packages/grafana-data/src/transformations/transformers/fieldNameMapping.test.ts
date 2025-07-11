import { firstValueFrom } from 'rxjs';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { transformDataFrame } from '../transformDataFrame';

import { fieldNameMappingTransformer, FieldNameMappingTransformerOptions } from './fieldNameMapping';
import { DataTransformerID } from './ids';

const configRefId = 'config';
const mappingFrame = toDataFrame({
  refId: configRefId,
  fields: [
    {
      name: 'letter',
      config: { displayName: 'letter' },
      type: FieldType.string,
      values: ['A', 'B', 'C', 'D'],
    },
    {
      name: 'names',
      config: { displayName: 'names' },
      type: FieldType.string,
      values: ['Alpha', 'Beta', 'Charlie', 'Delta'],
    },
    {
      name: 'ids',
      config: { displayName: 'ids' },
      type: FieldType.number,
      values: [1, 2, 3, 4],
    },
  ],
});

const dataFrame = toDataFrame({
  fields: [
    {
      name: 'A',
      type: FieldType.string,
      values: [],
    },
    {
      name: 'C',
      type: FieldType.string,
      values: [],
    },
    {
      name: 'E',
      type: FieldType.string,
      values: [],
    },
  ],
});
const data = [mappingFrame, dataFrame];

const baseConfig = {
  configRefId,
  from: 'letter',
  to: 'names',
};

const baseNames = ['A', 'C', 'E'];
async function expectMappingNamesToBe(options: FieldNameMappingTransformerOptions, names: string[]) {
  const conf = { id: DataTransformerID.fieldNameMapping, options };
  let res = await firstValueFrom(transformDataFrame([conf], data));

  expect(res).toHaveLength(2);

  // Keep non matching fields as is
  expect(res[0].refId).toBe(configRefId);
  expect(res[0].fields.map((field) => getFieldDisplayName(field))).toEqual(['letter', 'names', 'ids']);

  expect(res[1].fields.map((field) => getFieldDisplayName(field))).toEqual(names);
}

describe('Field Name Mapping Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([fieldNameMappingTransformer]);
  });

  it('applies the mapping', async () => {
    expectMappingNamesToBe(baseConfig, ['Alpha', 'Charlie', 'E']);
  });

  it('convert to string', async () => {
    expectMappingNamesToBe(
      {
        ...baseConfig,
        to: 'ids',
      },
      ['1', '3', 'E']
    );
  });

  it('handle non existing target', async () => {
    expectMappingNamesToBe(
      {
        ...baseConfig,
        to: 'does not exist',
      },
      baseNames
    );
  });

  it('handle non existing source', async () => {
    expectMappingNamesToBe(
      {
        ...baseConfig,
        from: 'does not exist',
      },
      baseNames
    );
  });
});
