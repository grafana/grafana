import { useMemo } from 'react';

import { standardTransformersRegistry } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { DataTransformerConfig } from '@grafana/schema';

import { Transformation } from '../types';
import { isDataTransformerConfig } from '../utils';

/**
 * Hook to subscribe to transformations from a SceneDataTransformer.
 * Returns a reactive array of Transformation objects.
 */
export function useTransformations(dataTransformer: SceneDataTransformer | null): Transformation[] {
  const transformerState = dataTransformer?.useState();

  return useMemo(() => {
    if (!dataTransformer) {
      return [];
    }

    // Filter to only include DataTransformerConfig items (exclude CustomTransformerDefinition)
    const transformationList = (transformerState?.transformations || []).filter((t): t is DataTransformerConfig =>
      isDataTransformerConfig(t)
    );

    // Use the transformation's id + index as a stable key for React
    // transformConfig holds the actual object reference from Scene state
    return transformationList.map((t, index) => ({
      transformConfig: t,
      registryItem: standardTransformersRegistry.getIfExists(t.id),
      transformId: `${t.id}-${index}`,
    }));
  }, [dataTransformer, transformerState?.transformations]);
}
