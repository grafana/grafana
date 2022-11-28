import { standardTransformersRegistry } from '../../transformations';
import { DataTransformerInfo } from '../../types';

export const mockTransformationsRegistry = (transformers: Array<DataTransformerInfo<any>>) => {
  standardTransformersRegistry.setInit(() => {
    return transformers.map((t) => {
      return {
        id: t.id,
        aliasIds: t.aliasIds,
        name: t.name,
        transformation: t,
        description: t.description,
        editor: () => null,
      };
    });
  });
};
