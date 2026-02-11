import { useMemo } from 'react';

import { standardTransformersRegistry } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';

import { getTransformId, Transformation } from '../types';
import { filterDataTransformerConfigs } from '../utils';

/**
 * Hook to subscribe to transformations from a SceneDataTransformer.
 * Returns a reactive array of Transformation objects.
 */
export function useTransformations(dataTransformer: SceneDataTransformer | null): Transformation[] {
  const transformerState = dataTransformer?.useState();

  return useMemo(() => {
    if (!dataTransformer || !transformerState) {
      return [];
    }

    // Filter to only include DataTransformerConfig items (exclude CustomTransformerDefinition)
    const transformationList = filterDataTransformerConfigs(transformerState.transformations || []);

    // Use the transformation's id + index as a stable key for React
    // transformConfig holds the actual object reference from Scene state
    return transformationList.map((t, index) => ({
      transformConfig: t,
      registryItem: standardTransformersRegistry.getIfExists(t.id),
      transformId: getTransformId(t.id, index),
    }));
  }, [dataTransformer, transformerState]);
}
