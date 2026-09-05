import { useMemo } from 'react';

import { type DataFrame } from '@grafana/data';

import { type Transformation } from '../types';

import { frameMatcherFor } from './frameMatcher';
import {
  NO_CONFIGS,
  isInterpolatable,
  precedingTransformations,
  useInterpolatedConfigs,
  useTransformedFrames,
} from './useTransformedFrames';

interface UseTransformationInputDataOptions {
  selectedTransformation: Transformation | null;
  allTransformations: Transformation[];
  rawData: DataFrame[];
}

/**
 * Returns the input data for the selected transformation — the output of everything before it in
 * the pipeline (see {@link precedingTransformations}), narrowed to the frames its own filter admits.
 *
 * Without this, editors always see raw query data regardless of where they sit in the pipeline.
 * That causes false errors like "Organize fields only works with a single frame" even when
 * a Join earlier in the pipeline has already merged the frames, or when the transformation's own
 * filter picks out the single frame it runs over.
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

  const precedingOutput = useTransformedFrames(precedingConfigs, rawData);

  // Interpolated the same way the replay interpolates the configs it runs, so a filter written as
  // `$var` narrows by the value the pipeline matched on rather than by the literal.
  const selfConfigs = useMemo(
    () => (selectedTransformation ? [selectedTransformation.transformConfig] : NO_CONFIGS),
    [selectedTransformation]
  );
  const [interpolatedSelf] = useInterpolatedConfigs(selfConfigs);

  return useMemo(() => {
    // The transformation only ever runs over the frames its filter admits — `transformDataFrame`
    // applies that filter itself and merges the rest back afterwards — so the editor has to be shown
    // the same narrowed set. Otherwise an Organize editor sits behind a filter that picks one frame
    // and still reports on all of them.
    const matcher =
      interpolatedSelf && isInterpolatable(interpolatedSelf) ? frameMatcherFor(interpolatedSelf) : undefined;

    return matcher ? precedingOutput.filter((frame) => matcher(frame)) : precedingOutput;
  }, [interpolatedSelf, precedingOutput]);
}
