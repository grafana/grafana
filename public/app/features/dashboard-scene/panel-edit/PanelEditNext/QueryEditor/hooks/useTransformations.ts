import { useMemo } from 'react';

import { standardTransformersRegistry } from '@grafana/data';
import { type SceneDataTransformer } from '@grafana/scenes';

import { splitSystemTransformations } from '../../../../scene/systemTransformations';
import { type Transformation } from '../types';
import { filterDataTransformerConfigs, getTransformId } from '../utils';

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

    // Split first: the indices below are the basis PanelDataPaneNext mutates by. Filtering on shape
    // alone is only accidentally correct today, because the wrappers carry no `id`.
    const { userTransformations } = splitSystemTransformations(transformerState.transformations || []);

    // Filter to only include DataTransformerConfig items (exclude CustomTransformerDefinition)
    const transformationList = filterDataTransformerConfigs(userTransformations);

    // Use the transformation's id + index as a stable key for React
    // transformConfig holds the actual object reference from Scene state
    return transformationList.map((t, index) => ({
      transformConfig: t,
      registryItem: standardTransformersRegistry.getIfExists(t.id),
      transformId: getTransformId(t.id, index),
    }));
  }, [dataTransformer, transformerState]);
}
