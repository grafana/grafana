import { useMemo } from 'react';

import { standardTransformersRegistry } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';

import { getTransformationUid } from '../transformationUid';
import { Transformation } from '../types';
import { filterDataTransformerConfigs } from '../utils';

/**
 * Hook to subscribe to transformations from a SceneDataTransformer.
 * Returns a reactive array of Transformation objects with stable UUIDs.
 */
export function useTransformations(dataTransformer: SceneDataTransformer | null): Transformation[] {
  const transformerState = dataTransformer?.useState();

  return useMemo(() => {
    if (!dataTransformer || !transformerState) {
      return [];
    }

    // Filter to only include DataTransformerConfig items (exclude CustomTransformerDefinition)
    const transformationList = filterDataTransformerConfigs(transformerState.transformations || []);

    return transformationList.map((t) => ({
      transformConfig: t,
      registryItem: standardTransformersRegistry.getIfExists(t.id),
      transformId: getTransformationUid(t),
    }));
  }, [dataTransformer, transformerState]);
}
