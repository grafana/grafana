import { standardTransformersRegistry } from '../../transformations/standardTransformersRegistry';
import { DataTransformerInfo } from '../../types/transformations';

export const mockTransformationsRegistry = (transformers: DataTransformerInfo[]) => {
  standardTransformersRegistry.setInit(() => {
    return transformers.map((t) => {
      return {
        id: t.id,
        aliasIds: t.aliasIds,
        name: t.name,
        transformation: t,
        description: t.description,
        editor: () => null,
        imageDark: `build/img/${t.id}-dark.abc123.svg`,
        imageLight: `build/img/${t.id}-light.abc123.svg`,
      };
    });
  });
};
