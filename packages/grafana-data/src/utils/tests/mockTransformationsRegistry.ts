import { standardTransformersRegistry } from '../../transformations/standardTransformersRegistry';
import { calculateFieldTransformer } from '../../transformations/transformers/calculateField';
import { filterFieldsTransformer } from '../../transformations/transformers/filter';
import { filterFieldsByNameTransformer } from '../../transformations/transformers/filterByName';
import { DataTransformerID } from '../../transformations/transformers/ids';
import { type DataTransformerInfo } from '../../types/transformations';

export const mockTransformationsRegistry = (transformers: DataTransformerInfo[]) => {
  standardTransformersRegistry.setInit(() => {
    return transformers.map((t) => {
      return {
        id: t.id,
        aliasIds: t.aliasIds,
        name: t.name,
        transformation: () => Promise.resolve(t),
        description: t.description,
        editor: () => null,
        imageDark: `build/img/${t.id}-dark.abc123.svg`,
        imageLight: `build/img/${t.id}-light.abc123.svg`,
      };
    });
  });
};

function getTranformerById(id: DataTransformerID): DataTransformerInfo | null {
  switch (id) {
    case DataTransformerID.calculateField:
      return calculateFieldTransformer;
    case DataTransformerID.filterFieldsByName:
      return filterFieldsByNameTransformer;
    case DataTransformerID.filterFields:
      return filterFieldsTransformer;
    default:
      return null;
  }
}

/*
 * A helper function to mock the transformations registry with a subset of transformers by their IDs.
 * This is useful for tests that only need a few transformers and want to avoid the overhead of loading the entire registry.
 * It will throw an error if called outside of a test environment to prevent accidental usage in production code.
 * @param ids - An array of DataTransformerIDs to include in the mocked registry.
 * Example usage:
 *   mockTransformationsRegistryByIds([DataTransformerID.calculateField, DataTransformerID.filterFields]);
 * This will mock the registry to only include the calculateField and filterFields transformers.
 * Note: The transformers included in the registry will be the actual implementations, so they can be used in tests as normal.
 * The registry will be reset to its original state after each test, so this function can be safely used in multiple tests without interference.
 * @throws Will throw an error if called outside of a test environment.
 */
export function mockTransformationsRegistryByIds(ids: DataTransformerID[]): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('mockTransformationsRegistryByIds function can only be called from tests.');
  }

  const transformers: DataTransformerInfo[] = [];
  for (const id of ids) {
    const transformer = getTranformerById(id);
    if (transformer) {
      transformers.push(transformer);
    }
  }

  mockTransformationsRegistry(transformers);
}
