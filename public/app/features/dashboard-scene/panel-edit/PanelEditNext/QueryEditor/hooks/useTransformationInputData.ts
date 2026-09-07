import { useMemo } from 'react';

import { type DataFrame } from '@grafana/data';

import { type Transformation } from '../types';

import { NO_CONFIGS, precedingTransformations, useTransformedFrames } from './useTransformedFrames';

interface UseTransformationInputDataOptions {
  selectedTransformation: Transformation | null;
  allTransformations: Transformation[];
  rawData: DataFrame[];
}

/**
 * Returns the input data for the selected transformation — the output of everything before it in
 * the pipeline (see {@link precedingTransformations}).
 *
 * Without this, editors always see raw query data regardless of where they sit in the pipeline.
 * That causes false errors like "Organize fields only works with a single frame" even when
 * a Join earlier in the pipeline has already merged the frames.
 *
 * @param selectedTransformation - The transformation currently open in the editor.
 * @param allTransformations - The full ordered list of transformations in the pipeline.
 * @param rawData - Raw data frames from the query runner, before any transformations.
 * @returns Data frames that feed into the selected transformation.
 */
export function useTransformationInputData({
  selectedTransformation,
  allTransformations,
  rawData,
}: UseTransformationInputDataOptions): DataFrame[] {
  const precedingConfigs = useMemo(
    () =>
      // TransformationEditorRenderer won't render without a selected transformation, but the hook
      // accepts null so we guard here too and fall back to rawData.
      selectedTransformation ? precedingTransformations(selectedTransformation, allTransformations) : NO_CONFIGS,
    [selectedTransformation, allTransformations]
  );

  return useTransformedFrames(precedingConfigs, rawData);
}
