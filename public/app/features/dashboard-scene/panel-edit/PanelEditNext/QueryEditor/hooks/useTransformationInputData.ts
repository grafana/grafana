import { useMemo } from 'react';

import { type DataFrame } from '@grafana/data';

import { type Transformation } from '../types';

import {
  NO_CONFIGS,
  precedingTransformations,
  type TransformationConfigs,
  useTransformedFrames,
} from './useTransformedFrames';

interface UseTransformationInputDataOptions {
  selectedTransformation: Transformation | null;
  allTransformations: Transformation[];
  systemTransformations: TransformationConfigs;
  rawData: DataFrame[];
}

/**
 * Returns the input data for the selected transformation — the output of everything before it in
 * the pipeline, including the panel plugin's own transformations (see {@link precedingTransformations}).
 *
 * Without this, editors always see raw query data regardless of where they sit in the pipeline.
 * That causes false errors like "Organize fields only works with a single frame" even when
 * a Join earlier in the pipeline has already merged the frames.
 *
 * @param selectedTransformation - The transformation currently open in the editor.
 * @param allTransformations - The full ordered list of user transformations in the pipeline.
 * @param systemTransformations - Plugin-registered transformations, which run before all of those.
 * @param rawData - Raw data frames from the query runner, before any transformations.
 * @returns Data frames that feed into the selected transformation.
 */
export function useTransformationInputData({
  selectedTransformation,
  allTransformations,
  systemTransformations,
  rawData,
}: UseTransformationInputDataOptions): DataFrame[] {
  const precedingConfigs = useMemo(
    () =>
      // TransformationEditorRenderer won't render without a selected transformation, but the hook
      // accepts null so we guard here too and fall back to rawData.
      selectedTransformation
        ? precedingTransformations(selectedTransformation, allTransformations, systemTransformations)
        : NO_CONFIGS,
    [selectedTransformation, allTransformations, systemTransformations]
  );

  return useTransformedFrames(precedingConfigs, rawData);
}
