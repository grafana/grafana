import { useMemo } from 'react';

import { type DataFrame } from '@grafana/data';

import { type Transformation } from '../types';

import { NO_CONFIGS, precedingTransformations, useTransformedFrames } from './useTransformedFrames';

interface UsePreviousTransformationOutputOptions {
  selectedTransformation: Transformation | null;
  transformations: Transformation[];
  queryData: DataFrame[];
  queryTargets?: Array<{ refId: string }>;
}

/** Stable identity for "no frames to offer", so it does not re-run a consumer's effect. */
const NO_FRAMES: DataFrame[] = [];

/**
 * Merges data frames with empty frames for any requested refIds that didn't return results.
 * This ensures that all query targets are represented in the output, even if they returned no data.
 */
function mergeWithEmptyFrames(frames: DataFrame[], queryTargets?: Array<{ refId: string }>): DataFrame[] {
  const mergedResult = [...frames];
  queryTargets?.forEach((target) => {
    const refIdInResult = mergedResult.some((frame) => frame.refId === target.refId);
    if (!refIdInResult) {
      mergedResult.push({ refId: target.refId, fields: [], length: 0 });
    }
  });
  return mergedResult;
}

/**
 * Calculates the output of the previous transformation in the pipeline, for the filter display to
 * show which data frames are available for filtering.
 *
 * @returns Output of everything preceding the selected transformation, or the query result if
 * nothing does. Includes empty frames for refIds that were requested but didn't return results.
 */
export function usePreviousTransformationOutput({
  selectedTransformation,
  transformations,
  queryData,
  queryTargets,
}: UsePreviousTransformationOutputOptions): DataFrame[] {
  // A transformation the pipeline does not contain has no preceding output to show, and neither does
  // a query that has not returned anything yet.
  const isInPipeline =
    selectedTransformation !== null &&
    queryData.length > 0 &&
    transformations.some(({ transformId }) => transformId === selectedTransformation.transformId);

  const precedingConfigs = useMemo(
    () =>
      selectedTransformation && isInPipeline
        ? precedingTransformations(selectedTransformation, transformations)
        : NO_CONFIGS,
    [isInPipeline, selectedTransformation, transformations]
  );

  const precedingOutput = useTransformedFrames(precedingConfigs, queryData);

  return useMemo(
    () => (isInPipeline ? mergeWithEmptyFrames(precedingOutput, queryTargets) : NO_FRAMES),
    [isInPipeline, precedingOutput, queryTargets]
  );
}
